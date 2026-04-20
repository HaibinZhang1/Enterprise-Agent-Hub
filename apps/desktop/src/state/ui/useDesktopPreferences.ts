import type { PreferenceState, SettingsTheme } from "../../domain/p1.ts";
import type { DisplayLanguage } from "../../ui/desktopShared";

export const PREFERENCES_STORAGE_KEY = "enterprise-agent-hub:desktop-preferences";

export const defaultPreferences: PreferenceState = {
  language: "auto",
  autoDetectLanguage: true,
  theme: "classic",
  agentProvider: "openai",
  agentBaseURL: "https://api.openai.com/v1",
  agentApiKey: "",
  agentDefaultModel: "gpt-5.4",
  showInstallResults: true,
  syncLocalEvents: true
};

const settingsThemes: readonly SettingsTheme[] = ["classic", "fresh", "contrast", "dark"];

export function isSettingsTheme(value: unknown): value is SettingsTheme {
  return typeof value === "string" && settingsThemes.includes(value as SettingsTheme);
}

export function normalizePreferences(rawPreferences: Partial<PreferenceState>): PreferenceState {
  return {
    ...defaultPreferences,
    ...rawPreferences,
    theme: isSettingsTheme(rawPreferences.theme) ? rawPreferences.theme : defaultPreferences.theme
  };
}

export function loadPreferences(): PreferenceState {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) return defaultPreferences;
  try {
    return normalizePreferences(JSON.parse(raw) as Partial<PreferenceState>);
  } catch {
    return defaultPreferences;
  }
}

export function resolveDisplayLanguage(preferences: PreferenceState, fallbackLocale?: string): DisplayLanguage {
  if (!preferences.autoDetectLanguage && preferences.language !== "auto") {
    return preferences.language;
  }

  const candidate =
    fallbackLocale ||
    (typeof navigator !== "undefined" ? navigator.language : "") ||
    "zh-CN";
  return candidate.toLocaleLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}
