import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import type { PackageFileContent, PackageFileEntry } from "../../domain/p1.ts";
import type { DesktopUIState } from "../../state/useDesktopUIState.ts";
import type { P1WorkspaceState } from "../../state/useP1Workspace.ts";
import { downloadAuthenticatedFile } from "../../services/p1Client.ts";

export interface PageProps {
  workspace: P1WorkspaceState;
  ui: DesktopUIState;
}

export function AuthGateCard({ title, body, onLogin }: { title: string; body: string; onLogin: () => void }) {
  return (
    <section className="auth-gate">
      <div className="eyebrow">需要登录</div>
      <h1>{title}</h1>
      <p>{body}</p>
      <div className="inline-actions">
        <button className="btn btn-primary" onClick={onLogin}>登录同步</button>
      </div>
    </section>
  );
}

export function SectionEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function TagPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  return <span className={`pill tone-${tone}`}>{children}</span>;
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
          return <option key={normalized.value} value={normalized.value}>{normalized.label}</option>;
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

function renderMarkdownPreview(content: string) {
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
}: {
  files: PackageFileEntry[];
  packageURL?: string;
  downloadName: string;
  loadContent: (relativePath: string) => Promise<PackageFileContent>;
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
    return <SectionEmpty title="当前提交没有可展示文件" body="上传包后，SKILL.md、README.md 和文本说明会出现在这里。" />;
  }

  return (
    <section className="detail-block">
      <h3>文件预览</h3>
      <div className="package-preview-shell">
        <div className="package-file-list" data-testid="package-file-list">
          {files.map((file) => (
            <button
              key={file.relativePath}
              className={selectedPath === file.relativePath ? "package-file-row active" : "package-file-row"}
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
        <div className="package-preview-pane" data-testid="package-file-preview">
          {!selectedFile ? <SectionEmpty title="选择文件查看内容" body="优先支持 Markdown 和纯文本文件预览。" /> : null}
          {selectedFile && !selectedFile.previewable ? (
            <div className="stack-list">
              <div className="callout warning">
                <AlertTriangle size={16} />
                <span>
                  <strong>当前文件不支持在线预览</strong>
                  <small>仅支持 `.md`、`.markdown`、`.txt`；其他文件请下载提交包查看。</small>
                </span>
              </div>
              {packageURL ? (
                <div className="inline-actions">
                  <button className="btn btn-small" onClick={() => void downloadAuthenticatedFile(packageURL, downloadName)}>
                    <Download size={14} />
                    下载提交包
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedFile?.previewable && loading ? <p>正在加载文件内容…</p> : null}
          {selectedFile?.previewable && error ? <div className="callout warning"><AlertTriangle size={16} /> {error}</div> : null}
          {selectedFile?.previewable && !loading && !error && content ? (
            <div className="stack-list">
              {content.truncated ? (
                <div className="callout warning">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>内容已截断</strong>
                    <small>当前仅展示前 256 KB 文本，完整内容请下载提交包查看。</small>
                  </span>
                </div>
              ) : null}
              {content.fileType === "markdown" ? (
                <article
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(content.content) }}
                />
              ) : (
                <pre className="text-preview">{content.content}</pre>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function PreferenceToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
