import type { PublishDraft, PublishPrecheckResult } from "../../domain/p1.ts";

export function buildPublishPrecheck(draft: PublishDraft): PublishPrecheckResult {
  const totalSize = draft.files.reduce((sum, file) => sum + file.size, 0);
  const hasFolderSkillFile = draft.uploadMode === "folder" && draft.files.some((file) => file.name.endsWith("SKILL.md"));
  const zipSelected = draft.uploadMode === "zip" && draft.files.length === 1;
  const versionValid = /^\d+\.\d+\.\d+$/.test(draft.version.trim());
  const sizeUnderLimit = totalSize > 0 && totalSize <= 5 * 1024 * 1024;
  const fileCountKnown = draft.uploadMode === "folder";
  const fileCountUnderLimit = !fileCountKnown || draft.files.length <= 100;

  const items: PublishPrecheckResult["items"] = [
    {
      id: "skill-doc",
      label: "存在 SKILL.md",
      status: hasFolderSkillFile ? "pass" : zipSelected ? "pending" : "warn",
      message: hasFolderSkillFile ? "已在目录中找到 SKILL.md。" : zipSelected ? "ZIP 内容需由后端或 Tauri 解压后校验。" : "上传目录时需要包含 SKILL.md。"
    },
    {
      id: "semver",
      label: "SemVer 合法",
      status: versionValid ? "pass" : "warn",
      message: versionValid ? "版本号格式符合 x.y.z。" : "版本号需使用 x.y.z 格式。"
    },
    {
      id: "size",
      label: "包小于 5MB",
      status: draft.files.length === 0 ? "pending" : sizeUnderLimit ? "pass" : "warn",
      message: draft.files.length === 0 ? "选择 ZIP 或文件夹后可校验体积。" : sizeUnderLimit ? "当前前端可见文件总大小在限制内。" : "当前前端可见文件总大小已超出 5MB。"
    },
    {
      id: "count",
      label: "文件数小于 100",
      status: draft.files.length === 0 ? "pending" : fileCountUnderLimit ? "pass" : "warn",
      message: draft.files.length === 0
        ? "选择文件后可校验数量。"
        : fileCountKnown
          ? `当前目录共 ${draft.files.length} 个文件。`
          : "ZIP 内部文件数需由后端或 Tauri 解压后校验。"
    },
    {
      id: "risk",
      label: "脚本风险待人工复核",
      status: "pending",
      message: "风险脚本扫描与深层结构校验由后端或 Tauri 接手。"
    }
  ];

  const canSubmit =
    draft.skillID.trim().length > 0 &&
    draft.displayName.trim().length > 0 &&
    versionValid &&
    draft.changelog.trim().length > 0 &&
    draft.files.length > 0 &&
    sizeUnderLimit &&
    fileCountUnderLimit;

  return { items, canSubmit };
}
