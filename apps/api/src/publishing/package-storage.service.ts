import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client as MinioClient } from "minio";
import type { PackageFileContentDto, PackageFileEntryDto } from "../common/p1-contracts";
import {
  collectDirectoryFileCount,
  createManifestJson,
  normalizeRelativeUploadPath,
  sha256WithPrefix
} from "./publishing.utils";
import {
  collectExtractedPackageFiles,
  findCommonRootPrefix,
  type ExtractedPackageFile,
  isPreviewablePackageFile,
  packagePreviewFileType,
  stripCommonPrefix,
  streamToBuffer
} from "./publishing-package-preview";
import type {
  ReviewRecord,
  StagedPackageRecord,
  SubmissionInput,
  UploadedSubmissionFile
} from "./publishing.types";

const execFileAsync = promisify(execFile);
const maxPackageBytes = 5 * 1024 * 1024;
const maxPackageFileCount = 100;

@Injectable()
export class PackageStorageService {
  constructor(private readonly config: ConfigService) {}

  async stageSubmissionPackage(
    reviewID: string,
    input: SubmissionInput,
    files: UploadedSubmissionFile[]
  ): Promise<StagedPackageRecord> {
    const tempDir = await mkdtemp(join(tmpdir(), "eah-publish-"));
    const inputZipPath = join(tempDir, "input.zip");
    const extractDir = join(tempDir, "extract");
    const normalizedDir = join(tempDir, "normalized");
    const outputZipPath = join(tempDir, "package.zip");
    await mkdir(extractDir, { recursive: true });
    await mkdir(normalizedDir, { recursive: true });

    try {
      const zipUpload = files.length === 1 && /\.zip$/i.test(files[0].originalname);
      const folderUpload = files.some((file) => /[\\/]/.test(file.originalname));
      if (!zipUpload && !folderUpload) {
        throw new BadRequestException("validation_failed");
      }

      if (zipUpload) {
        await writeFile(inputZipPath, files[0].buffer);
        await this.unzipFile(inputZipPath, extractDir);
        const packageRoot = await this.resolvePackageRoot(extractDir);
        await this.copyDirectory(packageRoot, normalizedDir);
      } else {
        const strippedRoot = findCommonRootPrefix(files.map((file) => file.originalname));
        for (const file of files) {
          const relativePath = stripCommonPrefix(file.originalname, strippedRoot);
          const safePath = normalizeRelativeUploadPath(relativePath);
          const targetPath = join(normalizedDir, safePath);
          await mkdir(join(targetPath, ".."), { recursive: true });
          await writeFile(targetPath, file.buffer);
        }
      }
      const visibleFileCount = await collectDirectoryFileCount(normalizedDir);
      if (visibleFileCount > maxPackageFileCount || !(await this.hasSkillMarkdown(normalizedDir))) {
        throw new BadRequestException("validation_failed");
      }
      await writeFile(
        join(normalizedDir, "manifest.json"),
        createManifestJson({
          skillID: input.skillID,
          displayName: input.displayName,
          description: input.description,
          version: input.version,
          visibilityLevel: input.visibilityLevel,
          scopeType: input.scopeType,
          selectedDepartmentIDs: input.selectedDepartmentIDs,
          compatibleTools: input.compatibleTools,
          compatibleSystems: input.compatibleSystems,
          tags: input.tags,
          category: input.category
        })
      );

      await this.zipDirectory(normalizedDir, outputZipPath);
      const buffer = await readFile(outputZipPath);
      if (buffer.length > maxPackageBytes) {
        throw new BadRequestException("validation_failed");
      }
      const objectKey = `staging/${reviewID}/package.zip`;
      await this.writePackageObject(objectKey, buffer);
      return {
        bucket: this.packageBucket(),
        objectKey,
        sha256: sha256WithPrefix(buffer),
        sizeBytes: buffer.length,
        fileCount: await collectDirectoryFileCount(normalizedDir)
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async listPackageFilesForReview(review: ReviewRecord): Promise<PackageFileEntryDto[]> {
    let files: ExtractedPackageFile[] = [];
    try {
      files = await this.withExtractedReviewPackage(review, async (packageRoot) => collectExtractedPackageFiles(packageRoot));
    } catch (error) {
      if (error instanceof BadRequestException) {
        return [];
      }
      throw error;
    }
    return files.map((file) => ({
      relativePath: file.relativePath,
      fileType: packagePreviewFileType(file.relativePath),
      sizeBytes: file.sizeBytes,
      previewable: isPreviewablePackageFile(file.relativePath)
    }));
  }

  async readPackageFileContentForReview(review: ReviewRecord, relativePath: string): Promise<PackageFileContentDto> {
    const normalizedPath = normalizeRelativeUploadPath(relativePath);
    return this.withExtractedReviewPackage(review, async (packageRoot) => {
      const files = await collectExtractedPackageFiles(packageRoot);
      const file = files.find((item) => item.relativePath === normalizedPath);
      if (!file) {
        throw new NotFoundException("resource_not_found");
      }
      const fileType = packagePreviewFileType(file.relativePath);
      if (!isPreviewablePackageFile(file.relativePath)) {
        throw new BadRequestException("validation_failed");
      }

      const buffer = await readFile(file.absolutePath);
      const truncated = buffer.length > 256 * 1024;
      const contentBuffer = truncated ? buffer.subarray(0, 256 * 1024) : buffer;
      return {
        relativePath: file.relativePath,
        fileType,
        content: contentBuffer.toString("utf8"),
        truncated
      };
    });
  }

  async readReviewPackageBuffer(review: ReviewRecord): Promise<Buffer> {
    if (review.staged_package_object_key) {
      return this.readStageObject(review);
    }
    if (review.current_package_object_key) {
      return this.readPackageObject(review.current_package_bucket ?? this.packageBucket(), review.current_package_object_key);
    }
    throw new BadRequestException("validation_failed");
  }

  async readPackageMarkdownFile(bucket: string, objectKey: string, fileName: string): Promise<string | null> {
    const packageBuffer = await this.readPackageObject(bucket, objectKey);
    return this.withExtractedPackageBuffer(packageBuffer, async (packageRoot) => {
      const normalizedFileName = fileName.toLowerCase();
      const files = await collectExtractedPackageFiles(packageRoot);
      const file = files.find((item) => item.relativePath.toLowerCase() === normalizedFileName);
      if (!file || !isPreviewablePackageFile(file.relativePath) || packagePreviewFileType(file.relativePath) !== "markdown") {
        return null;
      }
      return (await readFile(file.absolutePath)).toString("utf8");
    });
  }

  async copyObject(sourceBucket: string, sourceObjectKey: string, targetBucket: string, targetObjectKey: string): Promise<void> {
    if (this.hasMinioConfigured()) {
      const buffer = await streamToBuffer(await this.minioClient().getObject(sourceBucket, sourceObjectKey));
      await this.minioClient().putObject(targetBucket, targetObjectKey, buffer, buffer.length, {
        "Content-Type": "application/zip"
      });
      return;
    }
    const sourcePath = join(this.localPackageStorageRoot(), sourceObjectKey);
    const targetPath = join(this.localPackageStorageRoot(), targetObjectKey);
    await mkdir(join(targetPath, ".."), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  async writePackageObject(objectKey: string, buffer: Buffer): Promise<void> {
    if (this.hasMinioConfigured()) {
      await this.minioClient().putObject(this.packageBucket(), objectKey, buffer, buffer.length, {
        "Content-Type": "application/zip"
      });
      return;
    }
    const targetPath = join(this.localPackageStorageRoot(), objectKey);
    await mkdir(join(targetPath, ".."), { recursive: true });
    await writeFile(targetPath, buffer);
  }

  packageBucket(): string {
    return this.config.get<string>("MINIO_SKILL_PACKAGE_BUCKET") ?? "skill-packages";
  }

  private async withExtractedReviewPackage<T>(review: ReviewRecord, callback: (packageRoot: string) => Promise<T>): Promise<T> {
    const buffer = await this.readReviewPackageBuffer(review);
    return this.withExtractedPackageBuffer(buffer, callback);
  }

  private async withExtractedPackageBuffer<T>(buffer: Buffer, callback: (packageRoot: string) => Promise<T>): Promise<T> {
    const tempDir = await mkdtemp(join(tmpdir(), "eah-package-preview-"));
    const zipPath = join(tempDir, "package.zip");
    const extractDir = join(tempDir, "extract");
    await mkdir(extractDir, { recursive: true });

    try {
      await writeFile(zipPath, buffer);
      await this.unzipFile(zipPath, extractDir);
      const packageRoot = await this.resolvePackageRoot(extractDir);
      return await callback(packageRoot);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private minioClient(): MinioClient {
    return new MinioClient({
      endPoint: this.config.get<string>("MINIO_ENDPOINT") ?? "127.0.0.1",
      port: Number(this.config.get<string>("MINIO_PORT") ?? 9000),
      useSSL: this.config.get<string>("MINIO_USE_SSL") === "true",
      accessKey: this.config.get<string>("MINIO_ACCESS_KEY") ?? "minioadmin",
      secretKey: this.config.get<string>("MINIO_SECRET_KEY") ?? "change-me-minio-secret"
    });
  }

  private localPackageStorageRoot(): string {
    return this.config.get<string>("LOCAL_PACKAGE_STORAGE_DIR") ?? join(process.cwd(), ".runtime-package-storage");
  }

  private hasMinioConfigured(): boolean {
    return Boolean(this.config.get<string>("MINIO_ENDPOINT"));
  }

  private async readStageObject(review: ReviewRecord): Promise<Buffer> {
    if (!review.staged_package_object_key) {
      throw new BadRequestException("validation_failed");
    }
    return this.readPackageObject(review.staged_package_bucket ?? this.packageBucket(), review.staged_package_object_key);
  }

  private async readPackageObject(bucket: string, objectKey: string): Promise<Buffer> {
    if (this.hasMinioConfigured()) {
      const stream = await this.minioClient().getObject(bucket, objectKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    return readFile(join(this.localPackageStorageRoot(), objectKey));
  }

  private async unzipFile(zipPath: string, targetDir: string): Promise<void> {
    await execFileAsync("unzip", ["-oq", zipPath, "-d", targetDir]);
  }

  private async zipDirectory(sourceDir: string, outputZipPath: string): Promise<void> {
    await execFileAsync("zip", ["-qr", outputZipPath, "."], { cwd: sourceDir });
  }

  private async resolvePackageRoot(extractDir: string): Promise<string> {
    const entries = await readdir(extractDir, { withFileTypes: true });
    const fileEntries = entries.filter((entry) => entry.isFile());
    const dirEntries = entries.filter((entry) => entry.isDirectory());
    if (fileEntries.length === 0 && dirEntries.length === 1) {
      return join(extractDir, dirEntries[0].name);
    }
    return extractDir;
  }

  private async copyDirectory(sourceDir: string, targetDir: string): Promise<void> {
    await mkdir(targetDir, { recursive: true });
    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else if (entry.isFile()) {
        await mkdir(join(targetPath, ".."), { recursive: true });
        await writeFile(targetPath, await readFile(sourcePath));
      }
    }
  }

  private async hasSkillMarkdown(sourceDir: string): Promise<boolean> {
    const entries = await readdir(sourceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
        return true;
      }
      if (entry.isDirectory() && (await this.hasSkillMarkdown(join(sourceDir, entry.name)))) {
        return true;
      }
    }
    return false;
  }
}
