import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Client as MinioClient } from 'minio';
import { Client as PgClient } from 'pg';
import { hasPlaceholderSecret } from '../config/runtime-config';

export type DependencyStatus = 'ok' | 'not_configured' | 'unavailable' | 'invalid';

export interface DependencyCheck {
  status: DependencyStatus;
  reason?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  ready: boolean;
  api: 'ok';
  postgres: DependencyStatus;
  redis: DependencyStatus;
  minio: DependencyStatus;
  config: DependencyStatus;
  checks: {
    postgres: DependencyCheck;
    redis: DependencyCheck;
    minio: DependencyCheck;
    config: DependencyCheck;
  };
  reasons: string[];
  checkedAt: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService) {}

  async check(): Promise<HealthResponse> {
    const [postgres, redis, minio, config] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkMinio(),
      Promise.resolve(this.checkConfig()),
    ]);
    const checks = { postgres, redis, minio, config };
    const reasons = Object.values(checks)
      .filter((check) => check.status !== 'ok' && check.reason)
      .map((check) => check.reason as string);
    const ready = Object.values(checks).every((check) => check.status === 'ok' || check.status === 'not_configured');

    return {
      status: ready ? 'ok' : 'degraded',
      ready,
      api: 'ok',
      postgres: postgres.status,
      redis: redis.status,
      minio: minio.status,
      config: config.status,
      checks,
      reasons,
      checkedAt: new Date().toISOString(),
    };
  }

  private checkConfig(): DependencyCheck {
    const databaseURL = this.config.get<string>('DATABASE_URL');
    if (!databaseURL) {
      return { status: 'invalid', reason: 'DATABASE_URL is missing' };
    }

    if ((this.config.get<string>('NODE_ENV') ?? 'development') === 'production') {
      const jwtSecret = this.config.get<string>('JWT_SECRET');
      if (hasPlaceholderSecret(jwtSecret)) {
        return { status: 'invalid', reason: 'JWT_SECRET is still a placeholder' };
      }
      const minioSecret = this.config.get<string>('MINIO_SECRET_KEY');
      if (hasPlaceholderSecret(minioSecret)) {
        return { status: 'invalid', reason: 'MINIO_SECRET_KEY is still a placeholder' };
      }
    }

    return { status: 'ok' };
  }

  private async checkPostgres(): Promise<DependencyCheck> {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      return { status: 'not_configured', reason: 'DATABASE_URL is missing' };
    }

    const client = new PgClient({ connectionString, connectionTimeoutMillis: 1_000 });
    try {
      await client.connect();
      await client.query('select 1');
      return { status: 'ok' };
    } catch {
      return { status: 'unavailable', reason: 'PostgreSQL check failed' };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      return { status: 'not_configured', reason: 'REDIS_URL is missing' };
    }

    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1_000 });
    try {
      await redis.connect();
      await redis.ping();
      return { status: 'ok' };
    } catch {
      return { status: 'unavailable', reason: 'Redis ping failed' };
    } finally {
      redis.disconnect();
    }
  }

  private async checkMinio(): Promise<DependencyCheck> {
    const endPoint = this.config.get<string>('MINIO_ENDPOINT');
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');
    if (!endPoint || !accessKey || !secretKey) {
      return { status: 'not_configured', reason: 'MinIO endpoint or credentials are missing' };
    }

    const minio = new MinioClient({
      endPoint,
      port: Number(this.config.get<string>('MINIO_PORT') ?? '9000'),
      useSSL: this.config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey,
      secretKey,
    });

    try {
      for (const bucket of this.requiredMinioBuckets()) {
        const exists = await minio.bucketExists(bucket);
        if (!exists) {
          return { status: 'unavailable', reason: `MinIO bucket ${bucket} is missing` };
        }
      }
      return { status: 'ok' };
    } catch {
      return { status: 'unavailable', reason: 'MinIO bucket readiness check failed' };
    }
  }

  private requiredMinioBuckets(): string[] {
    return [
      this.config.get<string>('MINIO_SKILL_PACKAGE_BUCKET') ?? 'skill-packages',
      this.config.get<string>('MINIO_SKILL_ASSET_BUCKET') ?? 'skill-assets',
      this.config.get<string>('MINIO_CLIENT_UPDATE_BUCKET') ?? 'client-updates',
    ];
  }
}
