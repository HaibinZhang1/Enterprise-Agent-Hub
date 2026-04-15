import type { PreferenceState } from "../../domain/p1.ts";
import type { DisplayLanguage } from "../../ui/desktopShared";

export const PREFERENCES_STORAGE_KEY = "enterprise-agent-hub:desktop-preferences";

export const defaultPreferences: PreferenceState = {
  language: "auto",
  autoDetectLanguage: true,
  theme: "classic",
  showInstallResults: true,
  syncLocalEvents: true
};

export function loadPreferences(): PreferenceState {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) return defaultPreferences;
  try {
    return { ...defaultPreferences, ...(JSON.parse(raw) as Partial<PreferenceState>) };
  } catch {
    return defaultPreferences;
  }
}

export function resolveDisplayLanguage(preferences: PreferenceState, fallbackLocale?: string): DisplayLanguage {
  if (!preferences.autoDetectLanguage && preferences.language !== "auto") {
    return preferences.language;
  }

  const candidate =
    (typeof navigator !== "undefined" ? navigator.language : "") ||
    fallbackLocale ||
    "zh-CN";
  return candidate.toLocaleLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}
