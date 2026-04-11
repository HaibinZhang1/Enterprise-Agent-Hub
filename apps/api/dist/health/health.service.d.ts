import { ConfigService } from '@nestjs/config';
export type DependencyStatus = 'ok' | 'not_configured' | 'unavailable';
export interface HealthResponse {
    status: 'ok' | 'degraded';
    api: 'ok';
    postgres: DependencyStatus;
    redis: DependencyStatus;
    minio: DependencyStatus;
    checkedAt: string;
}
export declare class HealthService {
    private readonly config;
    constructor(config: ConfigService);
    check(): Promise<HealthResponse>;
    private checkPostgres;
    private checkRedis;
    private checkMinio;
}
