import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SAFE_STORAGE_PREFIX,
  decryptionHint,
  decryptSafeStorageValue,
  looksLikeJwt,
} from './safeStorage';
import { SqliteFormatError, readKeyValue } from './sqliteReader';

const ACCESS_KEY = 'cursorAuth/accessToken';

export class AuthTokenError extends Error {
  constructor(
    message: string,
    readonly code: 'missing' | 'db' | 'encrypted' | 'decrypt',
  ) {
    super(message);
    this.name = 'AuthTokenError';
  }
}

function defaultStateDbPath(): string {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new AuthTokenError('APPDATA 未设置', 'db');
    }
    return path.join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  }
  return path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
}

function readTokenFromDbCli(dbPath: string): string | null {
  const sql = `SELECT value FROM ItemTable WHERE key='${ACCESS_KEY}' LIMIT 1;`;
  const binaries =
    process.platform === 'win32' ? ['sqlite3.exe', 'sqlite3'] : ['sqlite3', '/usr/bin/sqlite3'];
  for (const binary of binaries) {
    try {
      const output = execFileSync(binary, [dbPath, sql], {
        encoding: 'utf8',
        timeout: 10_000,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return output.length > 0 ? output : null;
    } catch {
      // try next binary
    }
  }
  return null;
}

function readRawTokenFromDb(dbPath: string): string | null {
  try {
    return readKeyValue(dbPath, 'ItemTable', ACCESS_KEY);
  } catch (err) {
    if (!(err instanceof SqliteFormatError)) {
      throw err;
    }
    return readTokenFromDbCli(dbPath);
  }
}

function resolveAccessToken(stored: string | null): string | null {
  if (!stored) {
    return null;
  }
  if (!stored.startsWith(SAFE_STORAGE_PREFIX)) {
    return stored;
  }
  try {
    const jwt = decryptSafeStorageValue(stored);
    if (!looksLikeJwt(jwt)) {
      throw new Error('Decrypted value is not a JWT');
    }
    return jwt;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    throw new AuthTokenError(
      `无法解密 Cursor 加密凭证（${detail}）。${decryptionHint()}`,
      'decrypt',
    );
  }
}

export function getAccessToken(customPath?: string): string | null {
  const dbPath = customPath?.trim() || defaultStateDbPath();
  if (!fs.existsSync(dbPath)) {
    return null;
  }
  try {
    return resolveAccessToken(readRawTokenFromDb(dbPath));
  } catch (err) {
    if (err instanceof AuthTokenError) {
      throw err;
    }
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildWorkosSessionCookie(accessToken: string): string | null {
  const payload = decodeJwtPayload(accessToken);
  const sub = payload?.sub;
  if (typeof sub !== 'string' || sub.length === 0) {
    return null;
  }
  const parts = sub.split('|');
  const userId = parts.length > 1 ? parts[1] : parts[0];
  if (!userId) {
    return null;
  }
  return `${userId}%3A%3A${accessToken}`;
}