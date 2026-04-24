import { useCallback, useState } from "react";
import type { DesktopModalState, ProjectDraft, ToolDraft } from "../../domain/p1.ts";
import type { P1WorkspaceState } from "../useP1Workspace.ts";
import { defaultProjectSkillsPath } from "../../utils/platformPaths.ts";

const defaultToolDraft: ToolDraft = {
  toolID: "custom_directory",
  name: "自定义目录",
  configPath: "",
  skillsPath: "",
  enabled: true
};

const defaultProjectDraft: ProjectDraft = {
  name: "",
  projectPath: "",
  skillsPath: "",
  enabled: true
};

function lastPathSegment(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export function useLocalConfigEditors(input: {
  workspace: P1WorkspaceState;
  closeModal: () => void;
  setModal: (modal: DesktopModalState) => void;
  setFlash: (flash: { tone: "info" | "warning" | "danger" | "success"; title: string; body: string } | null) => void;
  openConfirm: (input: {
    title: string;
    body: string;
    confirmLabel: string;
    tone: "primary" | "danger";
    detailLines?: string[];
    onConfirm?: () => Promise<void> | void;
  }) => void;
}) {
  const { workspace, closeModal, setModal, setFlash, openConfirm } = input;
  const [toolDraft, setToolDraft] = useState<ToolDraft>(defaultToolDraft);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);

  const openToolEditor = useCallback((tool?: P1WorkspaceState["tools"][number]) => {
    setToolDraft(
      tool
        ? {
            toolID: tool.toolID,
            name: tool.name,
            configPath: tool.configPath,
            skillsPath: tool.skillsPath,
            enabled: tool.enabled
          }
        : defaultToolDraft
    );
    setModal({ type: "tool_editor" });
  }, [setModal]);

  const openProjectEditor = useCallback((project?: P1WorkspaceState["projects"][number]) => {
    setProjectDraft(
      project
        ? {
            projectID: project.projectID,
            name: project.name,
            projectPath: project.projectPath,
            skillsPath: project.skillsPath,
            enabled: project.enabled
          }
        : defaultProjectDraft
    );
    setModal({ type: "project_editor" });
  }, [setModal]);

  const pickProjectDirectoryForDraft = useCallback(async () => {
    try {
      const picked = await workspace.pickProjectDirectory();
      if (!picked?.projectPath) return;

      setProjectDraft((current) => {
        const nextProjectPath = picked.projectPath;
        const nextProjectName = lastPathSegment(nextProjectPath);
        const previousDefaultSkillsPath = defaultProjectSkillsPath(current.projectPath);
        const nextDefaultSkillsPath = defaultProjectSkillsPath(nextProjectPath);
        const shouldUpdateName = !current.name.trim() || current.name.trim() === lastPathSegment(current.projectPath);
        const shouldUpdateSkillsPath = !current.skillsPath.trim() || current.skillsPath === previousDefaultSkillsPath;

        return {
          ...current,
          name: shouldUpdateName ? nextProjectName : current.name,
          projectPath: nextProjectPath,
          skillsPath: shouldUpdateSkillsPath ? nextDefaultSkillsPath : current.skillsPath
        };
      });
    } catch (error) {
      setFlash({
        tone: "warning",
        title: "无法打开文件夹选择器",
        body: error instanceof Error ? error.message : "请手动填写项目路径。"
      });
    }
  }, [setFlash, workspace]);

  const submitToolDraft = useCallback(async () => {
    const validation = await workspace.validateTargetPath(toolDraft.skillsPath);
    if (!validation.valid && !validation.canCreate) {
      setFlash({
        tone: "warning",
        title: "工具路径不可用",
        body: validation.reason ?? "请修复 skills 安装路径后再保存。"
      });
      return;
    }
    await workspace.saveToolConfig({
      toolID: toolDraft.toolID ?? "custom_directory",
      name: toolDraft.name,
      configPath: toolDraft.configPath,
      skillsPath: toolDraft.skillsPath,
      enabled: toolDraft.enabled
    });
    closeModal();
    setFlash({
      tone: "success",
      title: toolDraft.toolID === "custom_directory" ? "自定义目录已保存" : "工具配置已保存",
      body: "工具路径、启用状态和检测结果已写入本地 SQLite 真源。"
    });
  }, [closeModal, setFlash, toolDraft, workspace]);

  const submitProjectDraft = useCallback(async () => {
    if (projectDraft.skillsPath.trim().length > 0) {
      const validation = await workspace.validateTargetPath(projectDraft.skillsPath);
      if (!validation.valid && !validation.canCreate) {
        setFlash({
          tone: "warning",
          title: "项目路径不可用",
          body: validation.reason ?? "请修复项目 skills 目录后再保存。"
        });
        return;
      }
    } else if (!projectDraft.projectPath.trim()) {
      setFlash({
        tone: "warning",
        title: "项目路径不可用",
        body: "请先填写项目路径。"
      });
      return;
    }
    await workspace.saveProjectConfig(projectDraft);
    closeModal();
    setFlash({
      tone: "success",
      title: projectDraft.projectID ? "项目已更新" : "项目已保存",
      body: "项目路径、skills 目录和启用状态已写入本地 SQLite 真源。"
    });
  }, [closeModal, projectDraft, setFlash, workspace]);

  const confirmDeleteToolConfig = useCallback((toolID: string) => {
    const tool = workspace.tools.find((item) => item.toolID === toolID);
    if (!tool) {
      return;
    }
    if (tool.toolID === "custom_directory" && !tool.configuredPath && !tool.skillsPath.trim()) {
      setFlash({
        tone: "info",
        title: "当前没有可清空的自定义目录",
        body: "先填写并保存自定义目录后，才需要执行清空配置。"
      });
      return;
    }
    if (tool.enabledSkillCount > 0) {
      setFlash({
        tone: "warning",
        title: "暂时不能删除工具",
        body: "请先停用该工具下已启用的 Skill，再删除或恢复默认配置。"
      });
      return;
    }

    const resetOnly = tool.toolID !== "custom_directory";
    openConfirm({
      title: resetOnly ? `恢复 ${tool.displayName} 默认配置` : `清空 ${tool.displayName}`,
      body: resetOnly ? "这会移除当前工具的手动路径配置，并恢复为自动检测/默认配置。" : "这会清空当前自定义目录配置，并恢复到默认的空白添加状态。",
      confirmLabel: resetOnly ? "恢复默认" : "清空配置",
      tone: "danger",
      detailLines: [
        `工具：${tool.displayName}`,
        `skills 路径：${tool.skillsPath || "未配置"}`,
        `已启用 Skill：${tool.enabledSkillCount}`
      ],
      onConfirm: async () => {
        closeModal();
        try {
          await workspace.deleteToolConfig(tool.toolID);
          setFlash({
            tone: "success",
            title: resetOnly ? "工具配置已恢复默认" : "自定义目录已清空",
            body: resetOnly ? "手动配置已移除，当前工具已回到自动检测结果。" : "当前自定义目录已恢复为空白默认配置。"
          });
        } catch (error) {
          setFlash({
            tone: "warning",
            title: resetOnly ? "恢复默认失败" : "清空配置失败",
            body: error instanceof Error ? error.message : "请稍后重试。"
          });
        }
      }
    });
  }, [closeModal, openConfirm, setFlash, workspace]);

  const confirmDeleteProjectConfig = useCallback((projectID: string) => {
    const project = workspace.projects.find((item) => item.projectID === projectID);
    if (!project) {
      return;
    }
    if (project.enabledSkillCount > 0) {
      setFlash({
        tone: "warning",
        title: "暂时不能删除项目",
        body: "请先停用该项目下已启用的 Skill，再删除项目配置。"
      });
      return;
    }

    openConfirm({
      title: `删除项目 ${project.name}`,
      body: "这会从本地 SQLite 中删除项目配置，但不会自动删除项目目录中的其他文件。",
      confirmLabel: "删除项目",
      tone: "danger",
      detailLines: [
        `项目路径：${project.projectPath}`,
        `skills 路径：${project.skillsPath}`,
        `已启用 Skill：${project.enabledSkillCount}`
      ],
      onConfirm: async () => {
        closeModal();
        try {
          await workspace.deleteProjectConfig(project.projectID);
          setFlash({
            tone: "success",
            title: "项目已删除",
            body: "项目配置已从本地 SQLite 删除。"
          });
        } catch (error) {
          setFlash({
            tone: "warning",
            title: "删除项目失败",
            body: error instanceof Error ? error.message : "请稍后重试。"
          });
        }
      }
    });
  }, [closeModal, openConfirm, setFlash, workspace]);

  return {
    toolDraft,
    projectDraft,
    setToolDraft,
    setProjectDraft,
    openToolEditor,
    openProjectEditor,
    pickProjectDirectoryForDraft,
    confirmDeleteToolConfig,
    confirmDeleteProjectConfig,
    submitToolDraft,
    submitProjectDraft,
  };
}
