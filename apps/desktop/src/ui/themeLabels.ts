import type { PreferenceState } from "../domain/p1.ts";

type DisplayLanguage = "zh-CN" | "en-US";

export function themeLabel(theme: PreferenceState["theme"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        classic: "Classic",
        fresh: "Fresh",
        contrast: "Contrast",
        dark: "Dark"
      }[theme]
    : {
        classic: "经典白",
        fresh: "清爽蓝",
        contrast: "高对比",
        dark: "暗色"
      }[theme];
}
