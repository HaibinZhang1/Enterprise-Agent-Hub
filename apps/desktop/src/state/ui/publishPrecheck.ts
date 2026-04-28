import type { PublishDraft, PublishPrecheckResult } from "../../domain/p1.ts";
import { SKILL_CATEGORIES, SKILL_TAGS } from "../../domain/p1.ts";
import { isSkillMarkdownPath, validateSkillSlug } from "./publishPackageIntrospection.ts";

export function buildPublishPrecheck(draft: PublishDraft): PublishPrecheckResult {
  const totalSize = draft.files.reduce((sum, file) => sum + file.size, 0);
  const hasSkillFile = Boolean(draft.skillEntryPath) || draft.files.some((file) => isSkillMarkdownPath(file.relativePath) || isSkillMarkdownPath(file.name));
  const versionValid = /^\d+\.\d+\.\d+$/.test(draft.version.trim());
  const slugValidation = validateSkillSlug(draft.skillID);
  const sizeUnderLimit = totalSize > 0 && totalSize <= 5 * 1024 * 1024;
  const fileCountKnown = draft.uploadMode === "folder";
  const fileCountUnderLimit = !fileCountKnown || draft.files.length <= 100;
  const descriptionReady = draft.description.trim().length > 0;
  const changelogReady = draft.submissionType === "permission_change" || draft.changelog.trim().length > 0;
  const categoryReady = (SKILL_CATEGORIES as readonly string[]).includes(draft.category);
  const uniqueTags = [...new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))];
  const tagsReady =
    uniqueTags.length >= 1 &&
    uniqueTags.length <= 5 &&
    uniqueTags.length === draft.tags.length &&
    uniqueTags.every((tag) => (SKILL_TAGS as readonly string[]).includes(tag));

  const items: PublishPrecheckResult["items"] = [
    {
      id: "skill-doc",
      label: "存在 SKILL.md",
      status: hasSkillFile ? "pass" : "warn",
      message: hasSkillFile ? `已识别 ${draft.skillEntryPath ?? "SKILL.md"}。` : "Skill 文件夹或 ZIP 包必须包含 SKILL.md。"
    },
    {
      id: "slug",
      label: "Slug 合法",
      status: slugValidation.valid ? "pass" : "warn",
      message: slugValidation.message
    },
    {
      id: "semver",
      label: "SemVer 合法",
      status: versionValid ? "pass" : "warn",
      message: versionValid ? "版本号格式符合 x.y.z。" : "版本号需使用 x.y.z 格式。"
    },
    {
      id: "description",
      label: "描述已填写",
      status: descriptionReady ? "pass" : "warn",
      message: descriptionReady ? "描述已准备提交。" : "请填写描述，或上传包含 description frontmatter 的 SKILL.md。"
    },
    {
      id: "changelog",
      label: "变更说明已填写",
      status: changelogReady ? "pass" : "warn",
      message: changelogReady ? "变更说明已准备提交。" : "首次发布和更新发布都需要变更说明。"
    },
    {
      id: "category",
      label: "分类已选择",
      status: categoryReady ? "pass" : "warn",
      message: categoryReady ? `已选择「${draft.category}」。` : "请选择一个中文短分类。"
    },
    {
      id: "tags",
      label: "标签 1-5 个",
      status: tagsReady ? "pass" : "warn",
      message: tagsReady ? `已选择 ${uniqueTags.length} 个中文标签。` : "请选择 1-5 个固定中文标签。"
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
    slugValidation.valid &&
    hasSkillFile &&
    draft.displayName.trim().length > 0 &&
    descriptionReady &&
    versionValid &&
    changelogReady &&
    categoryReady &&
    tagsReady &&
    draft.files.length > 0 &&
    sizeUnderLimit &&
    fileCountUnderLimit;

  return { items, canSubmit };
}
