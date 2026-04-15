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
}) {
  const { workspace, closeModal, setModal, setFlash } = input;
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

  return {
    toolDraft,
    projectDraft,
    setToolDraft,
    setProjectDraft,
    openToolEditor,
    openProjectEditor,
    pickProjectDirectoryForDraft,
    submitToolDraft,
    submitProjectDraft,
  };
}
