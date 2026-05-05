import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { PackageFileContentDto, PackageFileEntryDto, PackagePreviewFileType } from "../common/p1-contracts";
import { normalizeRelativeUploadPath } from "./publishing.utils";

export interface ExtractedPackageFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

const maxPreviewBytes = 256 * 1024;

export function findCommonRootPrefix(paths: string[]): string {
  const firstSegments = new Set(
    paths
      .map((item) => item.replace(/\\/g, "/").split("/")[0])
      .filter(Boolean)
  );
  return firstSegments.size === 1 ? [...firstSegments][0] : "";
}

export function stripCommonPrefix(value: string, prefix: string): string {
  if (!prefix) {
    return value;
  }
  const normalized = value.replace(/\\/g, "/");
  return normalized.startsWith(`${prefix}/`) ? normalized.slice(prefix.length + 1) : normalized;
}

export async function collectExtractedPackageFiles(rootDir: string, baseDir = rootDir): Promise<ExtractedPackageFile[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files: ExtractedPackageFile[] = [];
  for (const entry of entries) {
    const absolutePath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectExtractedPackageFiles(absolutePath, baseDir)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const relativePath = normalizeRelativeUploadPath(
      absolutePath.slice(baseDir.length + 1).replace(/\\/g, "/")
    );
    const fileStat = await stat(absolutePath);
    files.push({
      relativePath,
      absolutePath,
      sizeBytes: fileStat.size
    });
  }
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function packagePreviewFileType(relativePath: string): PackagePreviewFileType {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "markdown";
  }
  if (lower.endsWith(".txt")) {
    return "text";
  }
  return "other";
}

export function isPreviewablePackageFile(relativePath: string): boolean {
  return packagePreviewFileType(relativePath) !== "other";
}

export function packageFileEntry(file: ExtractedPackageFile): PackageFileEntryDto {
  return {
    relativePath: file.relativePath,
    fileType: packagePreviewFileType(file.relativePath),
    sizeBytes: file.sizeBytes,
    previewable: isPreviewablePackageFile(file.relativePath)
  };
}

export function findPackageFile(files: ExtractedPackageFile[], relativePath: string): ExtractedPackageFile | undefined {
  return files.find((item) => item.relativePath === relativePath);
}

export async function readPackageFilePreviewContent(file: ExtractedPackageFile): Promise<PackageFileContentDto> {
  const fileType = packagePreviewFileType(file.relativePath);
  const buffer = await readFile(file.absolutePath);
  const truncated = buffer.length > maxPreviewBytes;
  const contentBuffer = truncated ? buffer.subarray(0, maxPreviewBytes) : buffer;
  return {
    relativePath: file.relativePath,
    fileType,
    content: contentBuffer.toString("utf8"),
    truncated
  };
}

export async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
