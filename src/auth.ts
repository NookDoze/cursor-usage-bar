import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ACCESS_KEY = 'cursorAuth/accessToken';

function defaultStateDbPath(): string {
  const home = os.homedir();
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error('APPDATA 未设置');
    }
    return path.join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
  }
  return path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb');
}

function readTokenFromDb(dbPath: string): string | null {
  if (!fs.existsSync(dbPath)) {
    return null;
  }
  const sql = `SELECT value FROM ItemTable WHERE key='${ACCESS_KEY}' LIMIT 1;`;
  const binaries = process.platform === 'win32' ? ['sqlite3.exe', 'sqlite3'] : ['sqlite3', '/usr/bin/sqlite3'];
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

export function getAccessToken(customPath?: string): string | null {
  const dbPath = customPath?.trim() || defaultStateDbPath();
  return readTokenFromDb(dbPath);
}
