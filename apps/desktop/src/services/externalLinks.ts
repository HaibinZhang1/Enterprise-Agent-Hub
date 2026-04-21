declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
  }
}

function getExternalInvoke() {
  if (typeof window === "undefined") return null;
  return window.__TAURI__?.core?.invoke ?? null;
}

export function isSafeExternalURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function openExternalURL(url: string): Promise<void> {
  if (!isSafeExternalURL(url)) {
    throw new Error("仅支持打开 http/https 链接。");
  }

  const invoke = getExternalInvoke();
  if (invoke) {
    await invoke("p1_open_external_url", { url });
    return;
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  throw new Error("当前环境无法打开外部链接。");
}
