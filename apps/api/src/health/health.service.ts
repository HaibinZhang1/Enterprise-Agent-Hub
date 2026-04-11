import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Client as MinioClient } from 'minio';
import { Client as PgClient } from 'pg';

export type DependencyStatus = 'ok' | 'not_configured' | 'unavailable';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  api: 'ok';
  postgres: DependencyStatus;
  redis: DependencyStatus;
  minio: DependencyStatus;
  checkedAt: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService) {}

  async check(): Promise<HealthResponse> {
    const [postgres, redis, minio] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkMinio(),
    ]);

    return {
      status: [postgres, redis, minio].every((status) => status === 'ok') ? 'ok' : 'degraded',
      api: 'ok',
      postgres,
      redis,
      minio,
      checkedAt: new Date().toISOString(),
    };
  }

  private async checkPostgres(): Promise<DependencyStatus> {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      return 'not_configured';
    }

    const client = new PgClient({ connectionString, connectionTimeoutMillis: 1_000 });
    try {
      await client.connect();
      await client.query('select 1');
      return 'ok';
    } catch {
      return 'unavailable';
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      return 'not_configured';
    }

    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1_000 });
    try {
      await redis.connect();
      await redis.ping();
      return 'ok';
    } catch {
      return 'unavailable';
    } finally {
      redis.disconnect();
    }
  }

  private async checkMinio(): Promise<DependencyStatus> {
    const endPoint = this.config.get<string>('MINIO_ENDPOINT');
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');
    if (!endPoint || !accessKey || !secretKey) {
      return 'not_configured';
    }

    const minio = new MinioClient({
      endPoint,
      port: Number(this.config.get<string>('MINIO_PORT') ?? '9000'),
      useSSL: this.config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey,
      secretKey,
    });

    try {
      await minio.listBuckets();
      return 'ok';
    } catch {
      return 'unavailable';
    }
  }
}
