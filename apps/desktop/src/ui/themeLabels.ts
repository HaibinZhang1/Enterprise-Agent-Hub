import type { PreferenceState } from "../domain/p1.ts";

type DisplayLanguage = "zh-CN" | "en-US";

export function themeLabel(theme: PreferenceState["theme"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        classic: "Classic",
        dark: "Dark"
      }[theme]
    : {
        classic: "经典白",
        dark: "暗色"
      }[theme];
}
