import type { BootstrapContext } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { clearToken, getAPIBase, getToken, requestJSON, setAPIBase, setToken } from "./core.ts";
import type { ApiBootstrapResponse, ApiLoginResponse } from "./shared.ts";
import { normalizeBootstrap } from "./shared.ts";

export function createAuthClient() {
  return {
    hasStoredSession() {
      return getToken() !== null;
    },

    clearStoredSession() {
      clearToken();
    },

    currentAPIBase() {
      return getAPIBase();
    },

    async login(input: { username: string; password: string; serverURL: string }): Promise<BootstrapContext> {
      if (input.username.trim().length === 0 || input.password.trim().length === 0) {
        throw new Error("账号或密码不能为空");
      }

      setAPIBase(input.serverURL);
      const response = await requestJSON<ApiLoginResponse>(P1_API_ROUTES.authLogin, {
        method: "POST",
        body: JSON.stringify({ username: input.username, password: input.password })
      });
      setToken(response.accessToken);
      return normalizeBootstrap(await requestJSON<ApiBootstrapResponse>(P1_API_ROUTES.desktopBootstrap));
    },

    async logout(): Promise<void> {
      try {
        if (getToken()) {
          await requestJSON<{ ok: true }>(P1_API_ROUTES.authLogout, { method: "POST" });
        }
      } finally {
        clearToken();
      }
    },

    async bootstrap(): Promise<BootstrapContext> {
      return normalizeBootstrap(await requestJSON<ApiBootstrapResponse>(P1_API_ROUTES.desktopBootstrap));
    },
  };
}
