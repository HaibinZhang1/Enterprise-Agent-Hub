import { createReadStream, existsSync } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';

@Injectable()
export class ClientUpdateStorageService {
  constructor(private readonly config: ConfigService) {}

  bucket(): string {
    return this.config.get<string>('MINIO_CLIENT_UPDATE_BUCKET') ?? 'client-updates';
  }

  async uploadArtifact(input: {
    releaseID: string;
    version: string;
    platform: string;
    arch: string;
    channel: string;
    packageName: string;
    buffer: Buffer;
  }): Promise<{ bucket: string; objectKey: string; sizeBytes: number }> {
    const objectKey = [input.platform, input.arch, input.channel, input.version, `${input.releaseID}-${input.packageName}`].join('/');
    if (this.hasMinioConfigured()) {
      await this.minioClient().putObject(this.bucket(), objectKey, input.buffer, input.buffer.length, {
        'Content-Type': 'application/octet-stream',
      });
      return { bucket: this.bucket(), objectKey, sizeBytes: input.buffer.length };
    }
    const targetPath = join(this.localStorageRoot(), objectKey);
    await mkdir(join(targetPath, '..'), { recursive: true });
    await writeFile(targetPath, input.buffer);
    return { bucket: this.bucket(), objectKey, sizeBytes: input.buffer.length };
  }

  async assertObjectExists(bucket: string, objectKey: string): Promise<void> {
    if (this.hasMinioConfigured()) {
      await this.minioClient().statObject(bucket, objectKey);
      return;
    }
    const targetPath = join(this.localStorageRoot(), objectKey);
    if (!existsSync(targetPath)) {
      throw new NotFoundException('package_unavailable');
    }
  }

  async openArtifactStream(bucket: string, objectKey: string): Promise<{ stream: Readable; contentLength: number }> {
    if (this.hasMinioConfigured()) {
      const client = this.minioClient();
      const metadata = await client.statObject(bucket, objectKey);
      const stream = await client.getObject(bucket, objectKey);
      return { stream, contentLength: Number(metadata.size) };
    }
    const targetPath = join(this.localStorageRoot(), objectKey);
    const metadata = await stat(targetPath);
    return { stream: createReadStream(targetPath), contentLength: metadata.size };
  }

  private hasMinioConfigured(): boolean {
    return Boolean(this.config.get<string>('MINIO_ENDPOINT'));
  }

  private minioClient(): MinioClient {
    return new MinioClient({
      endPoint: this.config.get<string>('MINIO_ENDPOINT') ?? '127.0.0.1',
      port: Number(this.config.get<string>('MINIO_PORT') ?? 9000),
      useSSL: this.config.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY') ?? 'minioadmin',
      secretKey: this.config.get<string>('MINIO_SECRET_KEY') ?? 'change-me-minio-secret',
    });
  }

  private localStorageRoot(): string {
    return this.config.get<string>('LOCAL_CLIENT_UPDATE_STORAGE_DIR') ?? join(process.cwd(), '.runtime-client-updates');
  }
}
