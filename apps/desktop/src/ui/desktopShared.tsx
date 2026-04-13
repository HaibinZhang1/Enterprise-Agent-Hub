import type { ReactNode } from "react";
import {
  Archive,
  BellDot,
  BookOpenCheck,
  Building2,
  ClipboardList,
  Command,
  FolderOpen,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Sparkles,
  SquareLibrary,
  Store,
  TerminalSquare,
  TestTube2,
  ToolCase,
  Workflow
} from "lucide-react";
import type {
  AdapterStatus,
  DetectionMethod,
  LocalNotification,
  NavigationPageID,
  PageID,
  PreferenceState,
  PublishDraft,
  PublishScopeType,
  ReviewAction,
  ReviewDecisionDraft,
  SubmissionType,
  ToolConfig,
  SkillSummary
} from "../domain/p1";
import type { P1WorkspaceState } from "../state/useP1Workspace";
import { formatDisplayDate } from "../utils/displayDate";

export type DisplayLanguage = "zh-CN" | "en-US";

export function localize(language: DisplayLanguage, zhCN: string, enUS: string): string {
  return language === "en-US" ? enUS : zhCN;
}

export function pageMetaFor(language: DisplayLanguage): Record<NavigationPageID, { label: string; icon: ReactNode; mark?: string }> {
  return {
    home: { label: localize(language, "首页", "Home"), icon: <LayoutDashboard size={18} /> },
    market: { label: localize(language, "市场", "Market"), icon: <Store size={18} /> },
    my_installed: { label: localize(language, "我的 Skill", "My Skills"), icon: <SquareLibrary size={18} /> },
    review: { label: localize(language, "审核", "Reviews"), icon: <ClipboardList size={18} /> },
    manage: { label: localize(language, "管理", "Admin"), icon: <ShieldCheck size={18} /> },
    tools: { label: localize(language, "工具", "Tools"), icon: <ToolCase size={18} /> },
    projects: { label: localize(language, "项目", "Projects"), icon: <FolderOpen size={18} /> },
    notifications: { label: localize(language, "通知", "Notifications"), icon: <BellDot size={18} /> },
    settings: { label: localize(language, "设置", "Settings"), icon: <Settings2 size={18} /> }
  };
}

export function categoryIcon(skill: SkillSummary): ReactNode {
  if (skill.category.includes("治理") || skill.category.includes("安全")) return <ShieldCheck size={18} />;
  if (skill.category.includes("文档")) return <BookOpenCheck size={18} />;
  if (skill.category.includes("测试")) return <TestTube2 size={18} />;
  if (skill.category.includes("工具")) return <Workflow size={18} />;
  if (skill.category.includes("CLI")) return <TerminalSquare size={18} />;
  return <Sparkles size={18} />;
}

export function formatDate(value: string | null, language: DisplayLanguage = "zh-CN"): string {
  return formatDisplayDate(value, language);
}

export function statusLabel(skill: SkillSummary, language: DisplayLanguage = "zh-CN"): string {
  if (skill.isScopeRestricted) return localize(language, "权限收缩", "Scope Restricted");
  switch (skill.installState) {
    case "not_installed":
      return localize(language, "未安装", "Not Installed");
    case "installed":
      return localize(language, "已安装", "Installed");
    case "enabled":
      return localize(language, "已启用", "Enabled");
    case "update_available":
      return localize(language, "有更新", "Update Available");
    case "blocked":
      return localize(language, "不可安装", "Blocked");
  }
}

export function riskLabel(skill: SkillSummary, language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? { low: "Low", medium: "Medium", high: "High", unknown: "Unknown" }[skill.riskLevel]
    : { low: "低", medium: "中", high: "高", unknown: "未知" }[skill.riskLevel];
}

export function roleLabel(user: P1WorkspaceState["currentUser"], language: DisplayLanguage = "zh-CN"): string {
  if (user.role === "guest") return localize(language, "本地模式", "Local Mode");
  if (user.role !== "admin") return localize(language, "普通用户", "User");
  return localize(language, `管理员 L${user.adminLevel ?? "?"}`, `Admin L${user.adminLevel ?? "?"}`);
}

export function labelForPage(page: PageID, language: DisplayLanguage = "zh-CN"): string {
  if (page === "detail") return localize(language, "详情", "Detail");
  return pageMetaFor(language)[page].label;
}

export function publishScopeLabel(scope: PublishDraft["scope"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        current_department: "Current Department",
        department_tree: "Department Tree",
        selected_departments: "Selected Departments",
        all_employees: "All Employees"
      }[scope]
    : {
        current_department: "本部门",
        department_tree: "本部门及下级部门",
        selected_departments: "指定多个部门",
        all_employees: "全员可用"
      }[scope];
}

export function submissionTypeLabel(type: SubmissionType, language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        publish: "Publish",
        update: "Update",
        permission_change: "Permission Change"
      }[type]
    : {
        publish: "首次发布",
        update: "更新发布",
        permission_change: "权限变更"
      }[type];
}

export function workflowStateLabel(state: string, language: DisplayLanguage = "zh-CN"): string {
  const zhCN: Record<string, string> = {
    system_prechecking: "系统初审中",
    manual_precheck: "待人工复核",
    pending_review: "待管理员审核",
    in_review: "审核中",
    returned_for_changes: "退回修改",
    review_rejected: "审核拒绝",
    withdrawn: "已撤回",
    published: "已发布"
  };
  const enUS: Record<string, string> = {
    system_prechecking: "System Precheck",
    manual_precheck: "Manual Precheck",
    pending_review: "Pending Review",
    in_review: "In Review",
    returned_for_changes: "Returned",
    review_rejected: "Rejected",
    withdrawn: "Withdrawn",
    published: "Published"
  };
  return (language === "en-US" ? enUS : zhCN)[state] ?? state;
}

export function reviewActionLabel(action: ReviewAction, language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        claim: "Claim",
        pass_precheck: "Pass Precheck",
        approve: "Approve",
        return_for_changes: "Return",
        reject: "Reject",
        withdraw: "Withdraw"
      }[action]
    : {
        claim: "开始审核",
        pass_precheck: "通过初审",
        approve: "同意",
        return_for_changes: "退回",
        reject: "拒绝",
        withdraw: "撤回"
      }[action];
}

export function publishVisibilityLabel(visibility: PublishDraft["visibility"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        private: "Private",
        summary_visible: "Summary Visible",
        detail_visible: "Detail Visible",
        public_installable: "Public Installable"
      }[visibility]
    : {
        private: "默认不公开",
        summary_visible: "摘要公开",
        detail_visible: "详情公开",
        public_installable: "全员可安装"
      }[visibility];
}

export function reviewDecisionLabel(decision: ReviewDecisionDraft["decision"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        approve: "Approve",
        return_for_changes: "Return",
        reject: "Reject"
      }[decision]
    : {
        approve: "同意",
        return_for_changes: "退回修改",
        reject: "拒绝"
      }[decision];
}

export function themeLabel(theme: PreferenceState["theme"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        classic: "Classic",
        fresh: "Fresh",
        contrast: "Contrast"
      }[theme]
    : {
        classic: "经典白",
        fresh: "清爽绿",
        contrast: "高对比"
      }[theme];
}

export function settingsLanguageLabel(languageValue: PreferenceState["language"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        auto: "Automatic",
        "zh-CN": "Chinese",
        "en-US": "English"
      }[languageValue]
    : {
        auto: "自动",
        "zh-CN": "中文",
        "en-US": "English"
      }[languageValue];
}

export function adapterStatusLabel(status: AdapterStatus, language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        detected: "Detected",
        manual: "Manual",
        missing: "Missing",
        invalid: "Invalid",
        disabled: "Disabled"
      }[status]
    : {
        detected: "已检测",
        manual: "手动配置",
        missing: "未检测到",
        invalid: "路径无效",
        disabled: "已停用"
      }[status];
}

export function detectionMethodLabel(method: DetectionMethod, language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        registry: "Registry",
        default_path: "Default Path",
        manual: "Manual"
      }[method]
    : {
        registry: "注册表",
        default_path: "默认路径",
        manual: "手动"
      }[method];
}

export function transformStrategyLabel(strategy: ToolConfig["transformStrategy"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        codex_skill: "Codex Skill",
        claude_skill: "Claude Skill",
        cursor_rule: "Cursor Rule",
        windsurf_rule: "Windsurf Rule",
        opencode_skill: "OpenCode Skill",
        generic_directory: "Generic Directory"
      }[strategy]
    : {
        codex_skill: "Codex Skill",
        claude_skill: "Claude Skill",
        cursor_rule: "Cursor 规则",
        windsurf_rule: "Windsurf 规则",
        opencode_skill: "OpenCode Skill",
        generic_directory: "通用目录"
      }[strategy];
}

export function notificationSourceLabel(source: LocalNotification["source"], language: DisplayLanguage = "zh-CN"): string {
  return language === "en-US"
    ? {
        server: "Server",
        local: "Local",
        sync: "Sync"
      }[source]
    : {
        server: "服务端",
        local: "本地",
        sync: "同步"
      }[source];
}

export function flattenDepartments(nodes: P1WorkspaceState["adminData"]["departments"]): P1WorkspaceState["adminData"]["departments"] {
  const items: P1WorkspaceState["adminData"]["departments"] = [];
  for (const node of nodes) {
    items.push(node);
    items.push(...flattenDepartments(node.children));
  }
  return items;
}

export const publishLifecycle = [
  {
    title: "上传成功",
    body: "文件已接收，发布者仍可在正式接入后撤回。"
  },
  {
    title: "系统初审中",
    body: "结构、元数据和风险字段会进入自动校验。"
  },
  {
    title: "待人工复核",
    body: "异常不直接拒绝，而是进入审核员复核队列。"
  },
  {
    title: "待管理员审核",
    body: "审核链路按组织关系和权限动态计算。"
  },
  {
    title: "已发布",
    body: "正式接入后将进入市场；新版本审核期间旧版本继续可用。"
  }
];

export const shellBrand = {
  title: "Enterprise Agent Hub",
  subtitle: "Skill Workspace",
  icon: <Command size={18} />
};
