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
  NavigationPageID,
  PageID,
  PreferenceState,
  PublishDraft,
  ReviewDecisionDraft,
  SkillSummary
} from "../domain/p1";
import type { P1WorkspaceState } from "../state/useP1Workspace";

export const IMAGE_POOL = {
  login:
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
  context:
    "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=900&q=80",
  review:
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80",
  docs:
    "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=80",
  test:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80",
  bridge:
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  cli:
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=900&q=80",
  publish:
    "https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=900&q=80",
  dashboard:
    "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80"
} as const;

export const pageMeta: Record<NavigationPageID, { label: string; icon: ReactNode; mark?: string }> = {
  home: { label: "首页", icon: <LayoutDashboard size={18} /> },
  market: { label: "市场", icon: <Store size={18} /> },
  my_installed: { label: "我的 Skill", icon: <SquareLibrary size={18} /> },
  review: { label: "审核", icon: <ClipboardList size={18} /> },
  manage: { label: "管理", icon: <ShieldCheck size={18} /> },
  tools: { label: "工具", icon: <ToolCase size={18} /> },
  projects: { label: "项目", icon: <FolderOpen size={18} /> },
  notifications: { label: "通知", icon: <BellDot size={18} /> },
  settings: { label: "设置", icon: <Settings2 size={18} /> }
};

export function categoryIcon(skill: SkillSummary): ReactNode {
  if (skill.category.includes("治理") || skill.category.includes("安全")) return <ShieldCheck size={18} />;
  if (skill.category.includes("文档")) return <BookOpenCheck size={18} />;
  if (skill.category.includes("测试")) return <TestTube2 size={18} />;
  if (skill.category.includes("工具")) return <Workflow size={18} />;
  if (skill.category.includes("CLI")) return <TerminalSquare size={18} />;
  return <Sparkles size={18} />;
}

export function imageForSkill(skill: SkillSummary): string {
  if (skill.skillID.includes("review")) return IMAGE_POOL.review;
  if (skill.skillID.includes("context")) return IMAGE_POOL.context;
  if (skill.skillID.includes("readme")) return IMAGE_POOL.docs;
  if (skill.skillID.includes("test")) return IMAGE_POOL.test;
  if (skill.skillID.includes("adapter")) return IMAGE_POOL.bridge;
  if (skill.skillID.includes("legacy") || skill.skillID.includes("cli")) return IMAGE_POOL.cli;
  return IMAGE_POOL.dashboard;
}

export function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function statusLabel(skill: SkillSummary): string {
  if (skill.isScopeRestricted) return "权限收缩";
  switch (skill.installState) {
    case "not_installed":
      return "未安装";
    case "installed":
      return "已安装";
    case "enabled":
      return "已启用";
    case "update_available":
      return "有更新";
    case "blocked":
      return "不可安装";
  }
}

export function riskLabel(skill: SkillSummary): string {
  return { low: "低", medium: "中", high: "高", unknown: "未知" }[skill.riskLevel];
}

export function roleLabel(user: P1WorkspaceState["currentUser"]): string {
  if (user.role === "guest") return "本地模式";
  if (user.role !== "admin") return "普通用户";
  return `管理员 L${user.adminLevel ?? "?"}`;
}

export function labelForPage(page: PageID): string {
  if (page === "detail") return "详情";
  return pageMeta[page].label;
}

export function publishScopeLabel(scope: PublishDraft["scope"]): string {
  return {
    current_department: "本部门",
    department_tree: "本部门及下级部门",
    selected_departments: "指定多个部门",
    all_employees: "全员可用"
  }[scope];
}

export function publishVisibilityLabel(visibility: PublishDraft["visibility"]): string {
  return {
    private: "默认不公开",
    summary_visible: "摘要公开",
    detail_visible: "详情公开",
    public_installable: "全员可安装"
  }[visibility];
}

export function reviewDecisionLabel(decision: ReviewDecisionDraft["decision"]): string {
  return {
    approve: "同意",
    return_for_changes: "退回修改",
    reject: "拒绝"
  }[decision];
}

export function themeLabel(theme: PreferenceState["theme"]): string {
  return {
    classic: "经典白",
    fresh: "清爽绿",
    contrast: "高对比"
  }[theme];
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
