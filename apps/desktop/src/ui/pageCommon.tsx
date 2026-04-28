import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Download, LockKeyhole, Search } from "lucide-react";
import type { PackageFileContent, PackageFileEntry } from "../domain/p1.ts";
import type { P1WorkspaceState } from "../state/useP1Workspace.ts";
import type { DesktopUIState } from "../state/useDesktopUIState.ts";
import { downloadAuthenticatedFile } from "../services/p1Client.ts";
import { detailBadgeMonogram, localize, skillInitials } from "./desktopShared.tsx";
import { iconToneForLabel, type IconTone } from "./iconTone.ts";

export interface SectionProps {
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
}

export function AuthGateCard({
  title,
  body,
  actionLabel,
  onLogin
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onLogin: () => void;
}) {
  return (
    <section className="empty-auth-card">
      <div className="empty-auth-icon">
        <LockKeyhole size={18} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <button className="btn btn-primary" type="button" onClick={onLogin}>
        {actionLabel ?? "登录继续"}
      </button>
    </section>
  );
}

export function SectionEmpty({
  title,
  body,
  compact = false,
  align = "center"
}: {
  title: string;
  body?: string;
  compact?: boolean;
  align?: "center" | "start";
}) {
  const className = ["empty-state", compact ? "compact" : "", align === "start" ? "align-start" : ""].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <Search size={18} />
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export function TagPill({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
}

export function InitialBadge({
  label,
  large = false,
  tone,
  className = ""
}: {
  label: string;
  large?: boolean;
  tone?: IconTone;
  className?: string;
}) {
  const resolvedTone = tone ?? iconToneForLabel(label);
  const classes = ["initial-badge", large ? "large" : "", `icon-tone-${resolvedTone}`, className].filter(Boolean).join(" ");
  return <span className={classes}>{large ? detailBadgeMonogram(label) : skillInitials(label)}</span>;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false
}: {
  label: string;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map((option) => {
          const normalized = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={normalized.value} value={normalized.value}>
              {normalized.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdownPreview(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeFence: string[] = [];
  let inCodeFence = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    parts.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    parts.push(`<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  }

  function flushCodeFence() {
    if (codeFence.length === 0) return;
    parts.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
    codeFence = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCodeFence) {
        flushCodeFence();
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeFence.push(line);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      parts.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushCodeFence();

  return parts.join("");
}

function fileTypeLabel(fileType: PackageFileEntry["fileType"]) {
  switch (fileType) {
    case "markdown":
      return "Markdown";
    case "text":
      return "Text";
    default:
      return "仅下载";
  }
}

function defaultPreviewFile(files: PackageFileEntry[]) {
  return files.find((file) => file.relativePath === "SKILL.md")
    ?? files.find((file) => file.previewable)
    ?? files[0]
    ?? null;
}

export function PackagePreviewPanel({
  files,
  packageURL,
  downloadName,
  loadContent,
  ui
}: {
  files: PackageFileEntry[];
  packageURL?: string;
  downloadName: string;
  loadContent: (relativePath: string) => Promise<PackageFileContent>;
  ui: DesktopUIState;
}) {
  const [selectedPath, setSelectedPath] = useState("");
  const [content, setContent] = useState<PackageFileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextDefault = defaultPreviewFile(files);
    setSelectedPath((current) => (current && files.some((file) => file.relativePath === current) ? current : nextDefault?.relativePath ?? ""));
  }, [files]);

  const selectedFile = files.find((file) => file.relativePath === selectedPath) ?? null;

  useEffect(() => {
    let active = true;
    if (!selectedFile || !selectedFile.previewable) {
      setContent(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    loadContent(selectedFile.relativePath)
      .then((result) => {
        if (!active) return;
        setContent(result);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setContent(null);
        setError(loadError instanceof Error ? loadError.message : "文件预览加载失败");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadContent, selectedFile]);

  if (files.length === 0) {
    return <SectionEmpty title="当前没有可展示文件" body="上传包后，SKILL.md、README.md 和文本说明会显示在这里。" />;
  }

  return (
    <section className="preview-shell">
      <div className="preview-list" data-testid="package-file-list">
        {files.map((file) => (
          <button
            key={file.relativePath}
            className={selectedPath === file.relativePath ? "preview-file active" : "preview-file"}
            type="button"
            data-testid="package-file-row"
            data-file-path={file.relativePath}
            onClick={() => setSelectedPath(file.relativePath)}
          >
            <span>
              <strong>{file.relativePath}</strong>
              <small>{fileTypeLabel(file.fileType)} · {Math.max(1, Math.round(file.sizeBytes / 1024))} KB</small>
            </span>
            <TagPill tone={file.previewable ? "info" : "warning"}>{file.previewable ? "可预览" : "下载查看"}</TagPill>
          </button>
        ))}
      </div>
      <div className="preview-pane" data-testid="package-file-preview">
        {!selectedFile ? <SectionEmpty title="选择文件查看内容" body="优先支持 Markdown 和纯文本文件预览。" /> : null}
        {selectedFile && !selectedFile.previewable ? (
          <div className="preview-empty">
            <strong>{selectedFile.relativePath}</strong>
            <p>{localize(ui.language, "该文件当前仅支持下载查看。", "This file currently supports download only.")}</p>
            {packageURL ? (
              <button className="btn btn-primary" type="button" onClick={() => void downloadAuthenticatedFile(packageURL, downloadName)}>
                <Download size={14} />
                下载原包
              </button>
            ) : null}
          </div>
        ) : null}
        {selectedFile && selectedFile.previewable && loading ? <div className="preview-empty"><strong>加载中...</strong></div> : null}
        {selectedFile && selectedFile.previewable && error ? <div className="preview-empty"><strong>{error}</strong></div> : null}
        {selectedFile && selectedFile.previewable && content ? (
          content.fileType === "markdown" ? (
            <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content.content) }} />
          ) : (
            <pre className="code-preview">{content.content}</pre>
          )
        ) : null}
      </div>
    </section>
  );
}
