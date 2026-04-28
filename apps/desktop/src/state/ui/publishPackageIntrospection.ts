export interface UploadEntry {
  file: File;
  relativePath: string;
}

export interface SkillMetadata {
  name?: string;
  description?: string;
}

export interface SkillSlugValidation {
  valid: boolean;
  message: string;
}

const skillSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const textDecoder = new TextDecoder();
const maxUploadBytes = 5 * 1024 * 1024;
const maxUploadFileCount = 100;

export function validateSkillSlug(value: string): SkillSlugValidation {
  const slug = value.trim();
  if (!slug) {
    return { valid: false, message: "Slug 必填。" };
  }
  if (!skillSlugPattern.test(slug)) {
    return { valid: false, message: "仅允许小写字母、数字和单个连字符，且不能以连字符开头或结尾。" };
  }
  return { valid: true, message: "Slug 格式正确。" };
}

export function displayNameFromSkillName(value: string): string {
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

export function parseSkillFrontmatter(markdown: string): SkillMetadata {
  const frontmatter = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!frontmatter) return {};

  const metadata: SkillMetadata = {};
  const lines = frontmatter[1].split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();
    if (value === "|" || value === ">") {
      const blockLines: string[] = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        blockLines.push(lines[index].trim());
      }
      value = blockLines.join(value === ">" ? " " : "\n").trim();
    }

    const normalizedValue = stripYamlQuotes(value);
    if (key === "name" && normalizedValue) {
      metadata.name = normalizedValue;
    }
    if (key === "description" && normalizedValue) {
      metadata.description = normalizedValue;
    }
  }

  return metadata;
}

export async function readSkillMarkdownFromUploadEntries(entries: UploadEntry[]): Promise<string | null> {
  const skillEntry = entries.find((entry) => isSkillMarkdownPath(entry.relativePath));
  if (skillEntry) {
    return skillEntry.file.text();
  }

  const zipEntry = entries.length === 1 && isZipPath(entries[0].relativePath) ? entries[0] : null;
  if (!zipEntry) return null;

  return extractTextFileFromZip(zipEntry.file, isSkillMarkdownPath);
}

export function validateUploadEntries(entries: UploadEntry[], uploadMode: "zip" | "folder"): string | null {
  if (entries.length === 0) {
    return "请选择 Skill 文件夹或 zip 包。";
  }

  const totalSize = entries.reduce((sum, entry) => sum + entry.file.size, 0);
  if (totalSize > maxUploadBytes) {
    return "上传内容不能超过 5MB。";
  }

  if (uploadMode === "zip") {
    if (entries.length !== 1 || !isZipPath(entries[0].relativePath)) {
      return "请选择单个 .zip 文件。";
    }
    return null;
  }

  if (entries.length > maxUploadFileCount) {
    return "文件夹内文件不能超过 100 个。";
  }
  if (entries.some((entry) => !entry.relativePath.replace(/\\/g, "/").includes("/"))) {
    return "请选择文件夹，不要选择单个文件。";
  }
  if (!entries.some((entry) => isSkillMarkdownPath(entry.relativePath))) {
    return "Skill 文件夹必须包含 SKILL.md。";
  }
  return null;
}

export function isSkillMarkdownPath(path: string): boolean {
  return /(^|\/)SKILL\.md$/i.test(path.replace(/\\/g, "/"));
}

function stripYamlQuotes(value: string): string {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value.trim();
}

export function isZipPath(path: string): boolean {
  return /\.zip$/i.test(path);
}

async function extractTextFileFromZip(file: File, matcher: (path: string) => boolean): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const centralDirectory = findCentralDirectory(view);
  if (!centralDirectory) return null;

  let offset = centralDirectory.offset;
  const end = centralDirectory.offset + centralDirectory.size;
  while (offset + 46 <= end && readUInt32(view, offset) === 0x02014b50) {
    const compressionMethod = readUInt16(view, offset + 10);
    const compressedSize = readUInt32(view, offset + 20);
    const fileNameLength = readUInt16(view, offset + 28);
    const extraLength = readUInt16(view, offset + 30);
    const commentLength = readUInt16(view, offset + 32);
    const localHeaderOffset = readUInt32(view, offset + 42);
    const nameStart = offset + 46;
    const name = textDecoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));

    if (matcher(name)) {
      const compressedData = readLocalFileData(bytes, view, localHeaderOffset, compressedSize);
      if (!compressedData) return null;
      const content = await decodeZipEntry(compressedData, compressionMethod);
      return textDecoder.decode(content);
    }

    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return null;
}

function findCentralDirectory(view: DataView): { offset: number; size: number } | null {
  const minOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(view, offset) === 0x06054b50) {
      return {
        size: readUInt32(view, offset + 12),
        offset: readUInt32(view, offset + 16)
      };
    }
  }
  return null;
}

function readLocalFileData(bytes: Uint8Array, view: DataView, localHeaderOffset: number, compressedSize: number): Uint8Array | null {
  if (readUInt32(view, localHeaderOffset) !== 0x04034b50) return null;
  const fileNameLength = readUInt16(view, localHeaderOffset + 26);
  const extraLength = readUInt16(view, localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + fileNameLength + extraLength;
  return bytes.slice(dataStart, dataStart + compressedSize);
}

async function decodeZipEntry(data: Uint8Array, compressionMethod: number): Promise<Uint8Array> {
  if (compressionMethod === 0) {
    return data;
  }
  if (compressionMethod !== 8) {
    throw new Error("暂不支持该 ZIP 压缩方式。");
  }

  const DecompressionStreamCtor = (globalThis as typeof globalThis & {
    DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
  }).DecompressionStream;
  if (!DecompressionStreamCtor) {
    throw new Error("当前浏览器不支持前端解压 ZIP。");
  }

  const payload = new ArrayBuffer(data.byteLength);
  new Uint8Array(payload).set(data);
  const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStreamCtor("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readUInt16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function readUInt32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}
