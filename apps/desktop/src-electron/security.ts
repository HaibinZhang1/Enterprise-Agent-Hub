import { ELECTRON_DEV_SERVER_URL } from "./ipcContract.ts";

export const PACKAGED_RENDERER_ORIGIN = "file://";

function parseURL(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isSafeExternalURL(url: string): boolean {
  const parsed = parseURL(url);
  return parsed?.protocol === "https:" || parsed?.protocol === "http:";
}

export function isAllowedDevRendererURL(url: string): boolean {
  const parsed = parseURL(url);
  if (!parsed) return false;
  const expected = new URL(ELECTRON_DEV_SERVER_URL);
  return parsed.protocol === "http:" && parsed.hostname === expected.hostname && parsed.port === expected.port;
}

export function isAllowedRendererURL(url: string, isPackaged: boolean): boolean {
  const parsed = parseURL(url);
  if (!parsed) return false;
  if (isPackaged) {
    return parsed.protocol === "file:";
  }
  return isAllowedDevRendererURL(url);
}

export function assertAllowedSenderURL(url: string | undefined, isPackaged: boolean): void {
  if (!url || !isAllowedRendererURL(url, isPackaged)) {
    throw new Error(`Rejected desktop IPC from untrusted renderer origin: ${url ?? "unknown"}`);
  }
}

export function shouldBlockNavigation(targetURL: string, currentURL: string | undefined, isPackaged: boolean): boolean {
  if (currentURL && targetURL === currentURL) return false;
  return !isAllowedRendererURL(targetURL, isPackaged);
}

export function buildRendererContentSecurityPolicy(isPackaged: boolean): string {
  const connectSrc = isPackaged ? "'self' https: http://127.0.0.1:*" : "'self' http://127.0.0.1:* ws://127.0.0.1:*";
  const scriptSrc = isPackaged ? "'self'" : "'self' 'unsafe-eval'";
  return [
    "default-src 'self'",
    `${scriptSrc ? `script-src ${scriptSrc}` : "script-src 'self'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}
