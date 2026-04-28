type LogLevel = "info" | "warn" | "error";

export interface StructuredLogFields {
  event: string;
  domain: string;
  action: string;
  entityID?: string;
  actorID?: string | null;
  result?: "ok" | "failed";
  reason?: string;
  durationMs?: number;
  detail?: Record<string, unknown>;
}

function emit(level: LogLevel, fields: StructuredLogFields): void {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    ...fields
  };
  const payload = JSON.stringify(entry);
  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.info(payload);
  }
}

export function logInfo(fields: StructuredLogFields): void {
  emit("info", fields);
}

export function logWarn(fields: StructuredLogFields): void {
  emit("warn", fields);
}

export function logError(fields: StructuredLogFields): void {
  emit("error", fields);
}
