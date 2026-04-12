/// <reference types="vite/client" />
import "react";

interface ImportMetaEnv {
  readonly VITE_DESKTOP_API_BASE_URL?: string;
  readonly VITE_P1_ALLOW_TAURI_MOCKS?: string;
  readonly VITE_P1_DEV_LOGIN_USERNAME?: string;
  readonly VITE_P1_DEV_LOGIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}
