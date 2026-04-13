const LOCAL_TIMESTAMP_PREFIX = "p1-local-";

export function parseDisplayDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(LOCAL_TIMESTAMP_PREFIX)) {
    const millis = Number.parseInt(trimmed.slice(LOCAL_TIMESTAMP_PREFIX.length), 10);
    if (Number.isFinite(millis)) {
      return new Date(millis);
    }
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDisplayDate(value: string | null, locale = "zh-CN"): string {
  const date = parseDisplayDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}
