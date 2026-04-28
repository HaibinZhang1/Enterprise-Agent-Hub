type EnvRecord = Record<string, unknown>;

const PLACEHOLDER_VALUES = new Set([
  "change-me",
  "change-me-before-deploy",
  "change-me-minio-secret",
  "minioadmin"
]);

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function expectPositiveInteger(value: string | undefined, key: string, errors: string[]): void {
  if (!value) return;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push(`${key} must be a positive integer`);
  }
}

function expectBucketName(value: string | undefined, key: string, errors: string[]): void {
  if (!value) return;
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value)) {
    errors.push(`${key} must be a valid lowercase bucket name`);
  }
}

function expectNoPlaceholderSecret(value: string | undefined, key: string, errors: string[]): void {
  if (!value || !PLACEHOLDER_VALUES.has(value)) {
    return;
  }
  errors.push(`${key} must not use a placeholder secret in production`);
}

function expectNoPlaceholderDatabasePassword(databaseURL: string | undefined, errors: string[]): void {
  if (!databaseURL) {
    return;
  }
  try {
    const parsed = new URL(databaseURL);
    if (PLACEHOLDER_VALUES.has(parsed.password)) {
      errors.push("DATABASE_URL must not embed a placeholder password in production");
    }
  } catch {
    errors.push("DATABASE_URL must be a valid URL");
  }
}

export function validateRuntimeConfig(env: EnvRecord): EnvRecord {
  const nodeEnv = asOptionalString(env.NODE_ENV) ?? "development";
  const errors: string[] = [];

  const apiPort = asOptionalString(env.API_PORT);
  const databaseURL = asOptionalString(env.DATABASE_URL);
  const redisURL = asOptionalString(env.REDIS_URL);
  const jwtSecret = asOptionalString(env.JWT_SECRET);
  const minioEndpoint = asOptionalString(env.MINIO_ENDPOINT);
  const minioPort = asOptionalString(env.MINIO_PORT);
  const minioAccessKey = asOptionalString(env.MINIO_ACCESS_KEY);
  const minioSecretKey = asOptionalString(env.MINIO_SECRET_KEY);
  const packageBucket = asOptionalString(env.MINIO_SKILL_PACKAGE_BUCKET);
  const assetBucket = asOptionalString(env.MINIO_SKILL_ASSET_BUCKET);
  const clientUpdateBucket = asOptionalString(env.MINIO_CLIENT_UPDATE_BUCKET);

  expectPositiveInteger(apiPort, "API_PORT", errors);
  expectPositiveInteger(minioPort, "MINIO_PORT", errors);
  expectBucketName(packageBucket, "MINIO_SKILL_PACKAGE_BUCKET", errors);
  expectBucketName(assetBucket, "MINIO_SKILL_ASSET_BUCKET", errors);
  expectBucketName(clientUpdateBucket, "MINIO_CLIENT_UPDATE_BUCKET", errors);

  if (!databaseURL) {
    errors.push("DATABASE_URL is required");
  }

  if (minioEndpoint || minioAccessKey || minioSecretKey) {
    if (!minioEndpoint) errors.push("MINIO_ENDPOINT is required when MinIO credentials are configured");
    if (!minioAccessKey) errors.push("MINIO_ACCESS_KEY is required when MinIO is configured");
    if (!minioSecretKey) errors.push("MINIO_SECRET_KEY is required when MinIO is configured");
  }

  if (nodeEnv === "production") {
    if (!jwtSecret) {
      errors.push("JWT_SECRET is required in production");
    }
    expectNoPlaceholderDatabasePassword(databaseURL, errors);
    expectNoPlaceholderSecret(jwtSecret, "JWT_SECRET", errors);
    expectNoPlaceholderSecret(minioAccessKey, "MINIO_ACCESS_KEY", errors);
    expectNoPlaceholderSecret(minioSecretKey, "MINIO_SECRET_KEY", errors);
    if (redisURL && !redisURL.startsWith("redis://") && !redisURL.startsWith("rediss://")) {
      errors.push("REDIS_URL must use redis:// or rediss://");
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid runtime configuration:\n- ${errors.join("\n- ")}`);
  }

  return env;
}

export function hasPlaceholderSecret(value: string | undefined): boolean {
  return value ? PLACEHOLDER_VALUES.has(value) : false;
}
