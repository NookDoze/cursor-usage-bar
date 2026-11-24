import { execFileSync } from 'child_process';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const SAFE_STORAGE_PREFIX = 'cursor-safe-storage:v1:';
const KEYCHAIN_SERVICE = 'Cursor Safe Storage';
const LINUX_FALLBACK_PASSWORD = 'peanuts';
const CRYPTO_IV = Buffer.alloc(16, 0x20);

function decryptCbc(password: string, iterations: number, body: Buffer): string {
  const key = pbkdf2Sync(password, 'saltysalt', iterations, 16, 'sha1');
  const decipher = createDecipheriv('aes-128-cbc', key, CRYPTO_IV);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8').trim();
}

function decryptGcm(key: Buffer, body: Buffer): string {
  if (body.length < 12 + 16) {
    throw new Error('Payload too short');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, body.subarray(0, 12));
  decipher.setAuthTag(body.subarray(body.length - 16));
  return Buffer.concat([decipher.update(body.subarray(12, body.length - 16)), decipher.final()])
    .toString('utf8')
    .trim();
}

function readKeychainPassword(): string {
  const output = execFileSync('security', ['find-generic-password', '-w', '-s', KEYCHAIN_SERVICE], {
    encoding: 'utf8',
    timeout: 15_000,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!output) {
    throw new Error('Empty Keychain password');
  }
  return output;
}

const LINUX_OSCRYPT_V2_SCHEMA = 'chrome_libsecret_os_crypt_password_v2';

const LINUX_PYTHON_OSCRYPT_LOOKUP = [
  "import os, sys",
  "schema = os.environ.get('CURSOR_USAGE_OSCRYPT_SCHEMA', '')",
  "app = os.environ.get('CURSOR_USAGE_OSCRYPT_APPLICATION', '')",
  "if not schema or not app: raise SystemExit(1)",
  "try: import secretstorage",
  "except ImportError: raise SystemExit(1)",
  "bus = secretstorage.dbus_init()",
  "coll = secretstorage.get_default_collection(bus)",
  "items = list(coll.search_items({'xdg:schema': schema, 'application': app}))",
  "if not items: raise SystemExit(1)",
  "sys.stdout.write(items[0].get_secret().decode())",
].join('\n');

function linuxSecretToolLookup(args: string[]): string | null {
  try {
    const output = execFileSync('secret-tool', ['lookup', ...args], {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function linuxPythonOsCryptLookup(application: string): string | null {
  try {
    const output = execFileSync('python3', ['-c', LINUX_PYTHON_OSCRYPT_LOOKUP], {
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: {
        ...process.env,
        CURSOR_USAGE_OSCRYPT_SCHEMA: LINUX_OSCRYPT_V2_SCHEMA,
        CURSOR_USAGE_OSCRYPT_APPLICATION: application,
      },
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function readLinuxKeyringPassword(): string {
  for (const app of ['Cursor', 'cursor']) {
    const fromTool =
      linuxSecretToolLookup(['xdg:schema', LINUX_OSCRYPT_V2_SCHEMA, 'application', app]) ??
      linuxPythonOsCryptLookup(app);
    if (fromTool) {
      return fromTool;
    }
  }

  for (const args of [
    ['service', KEYCHAIN_SERVICE, 'account', 'Cursor Key'],
    ['service', KEYCHAIN_SERVICE, 'account', 'Cursor'],
    ['application', 'cursor'],
    ['application', 'Cursor'],
  ]) {
    const output = linuxSecretToolLookup(args);
    if (output) {
      return output;
    }
  }

  throw new Error(
    'Could not read Secret Service password (install libsecret-tools or python3-secretstorage, and unlock your keyring)',
  );
}

function defaultLocalStatePath(): string {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error('APPDATA 未设置');
  }
  return path.join(appData, 'Cursor', 'Local State');
}

function readWindowsKey(localStatePath = defaultLocalStatePath()): Buffer {
  const state = JSON.parse(fs.readFileSync(localStatePath, 'utf8')) as {
    os_crypt?: { encrypted_key?: string };
  };
  const encoded = state.os_crypt?.encrypted_key;
  if (!encoded) {
    throw new Error('Local State 中无 os_crypt.encrypted_key');
  }
  const blob = Buffer.from(encoded, 'base64');
  if (blob.subarray(0, 5).toString('latin1') !== 'DPAPI') {
    throw new Error('Unsupported key protection');
  }
  const blobB64 = blob.subarray(5).toString('base64');
  const output = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Add-Type -AssemblyName System.Security; " +
        '$b=[Convert]::FromBase64String($env:CURSOR_USAGE_DPAPI_BLOB); ' +
        "$k=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'); " +
        '[Convert]::ToBase64String($k)',
    ],
    {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, CURSOR_USAGE_DPAPI_BLOB: blobB64 },
      windowsHide: true,
    },
  ).trim();
  const key = Buffer.from(output, 'base64');
  if (key.length !== 32) {
    throw new Error('Unexpected key length');
  }
  return key;
}

export function looksLikeJwt(token: string): boolean {
  const parts = token.split('.');
  return parts.length >= 2 && !token.startsWith(SAFE_STORAGE_PREFIX);
}

export function decryptSafeStorageValue(value: string, platform = process.platform): string {
  if (!value.startsWith(SAFE_STORAGE_PREFIX)) {
    return value;
  }

  const payload = Buffer.from(value.slice(SAFE_STORAGE_PREFIX.length), 'base64');
  const version = payload.subarray(0, 3).toString('latin1');
  const body = payload.subarray(3);

  switch (platform) {
    case 'darwin': {
      if (version !== 'v10') {
        throw new Error(`unsupported scheme ${version}`);
      }
      return decryptCbc(readKeychainPassword(), 1003, body);
    }
    case 'linux': {
      if (version === 'v10') {
        return decryptCbc(LINUX_FALLBACK_PASSWORD, 1, body);
      }
      if (version === 'v11') {
        return decryptCbc(readLinuxKeyringPassword(), 1, body);
      }
      throw new Error(`unsupported scheme ${version}`);
    }
    case 'win32': {
      if (version !== 'v10') {
        throw new Error(`unsupported scheme ${version}`);
      }
      return decryptGcm(readWindowsKey(), body);
    }
    default:
      throw new Error(`unsupported platform ${platform}`);
  }
}

export function decryptionHint(platform = process.platform): string {
  switch (platform) {
    case 'darwin':
      return '请允许访问 Keychain 中的「Cursor Safe Storage」，然后刷新。';
    case 'linux':
      return '请确保已解锁 GNOME Keyring/KWallet，并安装 secret-tool，然后刷新。';
    case 'win32':
      return '请在与 Cursor 登录相同的 Windows 用户下运行，然后刷新。';
    default:
      return '请刷新后重试。';
  }
}