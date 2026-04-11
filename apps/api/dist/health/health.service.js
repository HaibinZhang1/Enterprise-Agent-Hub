"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
const minio_1 = require("minio");
const pg_1 = require("pg");
let HealthService = class HealthService {
    config;
    constructor(config) {
        this.config = config;
    }
    async check() {
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
    async checkPostgres() {
        const connectionString = this.config.get('DATABASE_URL');
        if (!connectionString) {
            return 'not_configured';
        }
        const client = new pg_1.Client({ connectionString, connectionTimeoutMillis: 1_000 });
        try {
            await client.connect();
            await client.query('select 1');
            return 'ok';
        }
        catch {
            return 'unavailable';
        }
        finally {
            await client.end().catch(() => undefined);
        }
    }
    async checkRedis() {
        const redisUrl = this.config.get('REDIS_URL');
        if (!redisUrl) {
            return 'not_configured';
        }
        const redis = new ioredis_1.Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 0, connectTimeout: 1_000 });
        try {
            await redis.connect();
            await redis.ping();
            return 'ok';
        }
        catch {
            return 'unavailable';
        }
        finally {
            redis.disconnect();
        }
    }
    async checkMinio() {
        const endPoint = this.config.get('MINIO_ENDPOINT');
        const accessKey = this.config.get('MINIO_ACCESS_KEY');
        const secretKey = this.config.get('MINIO_SECRET_KEY');
        if (!endPoint || !accessKey || !secretKey) {
            return 'not_configured';
        }
        const minio = new minio_1.Client({
            endPoint,
            port: Number(this.config.get('MINIO_PORT') ?? '9000'),
            useSSL: this.config.get('MINIO_USE_SSL') === 'true',
            accessKey,
            secretKey,
        });
        try {
            await minio.listBuckets();
            return 'ok';
        }
        catch {
            return 'unavailable';
        }
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], HealthService);
