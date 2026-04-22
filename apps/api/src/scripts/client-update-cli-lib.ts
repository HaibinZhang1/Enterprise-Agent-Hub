import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import process from 'node:process';

export interface ClientUpdateCliArgs {
  [key: string]: string | boolean | undefined;
}

export function parseArgs(argv: string[]): ClientUpdateCliArgs {
  const args: ClientUpdateCliArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry?.startsWith('--')) {
      continue;
    }
    const key = entry.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

export function requireStringArg(args: ClientUpdateCliArgs, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required --${key}`);
  }
  return value.trim();
}

export function optionalStringArg(args: ClientUpdateCliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function optionalIntArg(args: ClientUpdateCliArgs, key: string): number | undefined {
  const value = optionalStringArg(args, key);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`--${key} must be an integer`);
  }
  return parsed;
}

export function optionalBooleanArg(args: ClientUpdateCliArgs, key: string): boolean | undefined {
  const value = args[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`--${key} must be true or false`);
}

export async function resolveAdminPassword(envKey = 'EAH_ADMIN_PASSWORD'): Promise<string> {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const password = (await rl.question('Admin password: ')).trim();
    if (!password) {
      throw new Error('Admin password is required');
    }
    return password;
  } finally {
    rl.close();
  }
}

export async function loginAdmin(input: {
  serverURL: string;
  adminPhone: string;
  password: string;
}): Promise<string> {
  const response = await requestJSON<{ accessToken: string }>('/auth/login', {
    serverURL: input.serverURL,
    method: 'POST',
    body: JSON.stringify({ phoneNumber: input.adminPhone, password: input.password }),
    headers: { 'content-type': 'application/json' },
  });
  return response.accessToken;
}

export function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

export async function requestJSON<T>(
  path: string,
  init: {
    serverURL: string;
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  },
): Promise<T> {
  const response = await fetch(new URL(path, ensureTrailingSlash(init.serverURL)), {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `${response.status} ${response.statusText}`);
  }
  return payload as T;
}

export async function uploadArtifact(input: {
  serverURL: string;
  accessToken: string;
  releaseID: string;
  artifactPath: string;
  packageName: string;
  sha256: string;
  signatureStatus: string;
}): Promise<unknown> {
  const buffer = await readFile(input.artifactPath);
  const form = new FormData();
  form.append('packageName', input.packageName);
  form.append('sha256', input.sha256);
  form.append('signatureStatus', input.signatureStatus);
  form.append('sizeBytes', String(buffer.length));
  form.append('file', new Blob([buffer]), input.packageName);
  return requestJSON(`/admin/client-updates/releases/${encodeURIComponent(input.releaseID)}/artifact`, {
    serverURL: input.serverURL,
    method: 'POST',
    headers: authHeaders(input.accessToken),
    body: form,
  });
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
