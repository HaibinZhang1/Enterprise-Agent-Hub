import type { BootstrapContext } from "../../domain/p1.ts";
import { P1_API_ROUTES } from "@enterprise-agent-hub/shared-contracts";
import { P1ApiError, clearToken, getAPIBase, getToken, requestJSON, setAPIBase, setToken } from "./core.ts";
import type { ApiBootstrapResponse, ApiLoginResponse } from "./shared.ts";
import { normalizeBootstrap } from "./shared.ts";

function validatePhoneNumber(value: string): string | null {
  if (!value.trim()) return "请输入手机号。";
  if (!/^\d+$/.test(value.trim())) return "手机号只能输入数字。";
  if (value.trim().length !== 11) return "手机号需为 11 位数字。";
  if (!value.trim().startsWith("1")) return "手机号需以 1 开头。";
  return null;
}

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

    async login(input: { phoneNumber: string; password: string; serverURL: string }): Promise<BootstrapContext> {
      const phoneError = validatePhoneNumber(input.phoneNumber);
      if (phoneError) {
        throw new Error(phoneError);
      }
      if (input.password.trim().length === 0) {
        throw new Error("请输入密码。");
      }

      setAPIBase(input.serverURL);
      let response: ApiLoginResponse;
      try {
        response = await requestJSON<ApiLoginResponse>(P1_API_ROUTES.authLogin, {
          method: "POST",
          body: JSON.stringify({ phoneNumber: input.phoneNumber, password: input.password })
        });
      } catch (error) {
        throw normalizeLoginError(error);
      }
      setToken(response.accessToken);
      try {
        return normalizeBootstrap(await requestJSON<ApiBootstrapResponse>(P1_API_ROUTES.desktopBootstrap));
      } catch (error) {
        clearToken();
        throw error;
      }
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

    async changeOwnPassword(input: { currentPassword: string; nextPassword: string }): Promise<void> {
      await requestJSON<{ ok: true }>(P1_API_ROUTES.authChangePassword, {
        method: "POST",
        body: JSON.stringify(input)
      }).catch((error) => {
        throw normalizePasswordChangeError(error);
      });
    },

    async bootstrap(): Promise<BootstrapContext> {
      return normalizeBootstrap(await requestJSON<ApiBootstrapResponse>(P1_API_ROUTES.desktopBootstrap));
    },
  };
}

function normalizeLoginError(error: unknown): Error {
  if (!(error instanceof P1ApiError)) {
    return error instanceof Error ? error : new Error("登录失败，请稍后重试。");
  }

  if (error.message.includes("用户名或密码不能为空")) {
    return new Error("手机号或密码不能为空。");
  }
  if (error.message.includes("用户名或密码错误")) {
    return new Error("手机号或密码错误。");
  }
  return error;
}

function normalizePasswordChangeError(error: unknown): Error {
  if (!(error instanceof P1ApiError)) {
    return error instanceof Error ? error : new Error("修改密码失败，请稍后重试。");
  }
  if (error.message.includes("当前密码错误")) {
    return new Error("当前密码错误。");
  }
  if (error.message.includes("密码至少需要 12 位")) {
    return new Error("密码至少需要 12 位，且必须包含大写字母、小写字母、数字和特殊字符。");
  }
  return error;
}
