import { Archive } from "lucide-react";
import { AuthGateCard, PageProps, TagPill } from "./pageCommon.tsx";

export function AdminSkillsPage({ workspace, ui }: PageProps) {
  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("admin_skills")) {
    return <AuthGateCard title="Skill 管理仅对在线管理员开放" body="登录并保持连接后，可执行上架、下架与归档动作。" onLogin={() => workspace.requireAuth("admin_skills")} />;
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">管理员视角</div>
          <h1>Skill 管理</h1>
          <p>统一处理上架状态、归档和市场治理动作；当前仍沿用后端真实写入。</p>
        </div>
        <TagPill tone="info">{workspace.adminData.adminSkills.length} 个 Skill</TagPill>
      </section>

      <section className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>发布者</th>
              <th>状态</th>
              <th>热度</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {workspace.adminData.adminSkills.map((skill) => (
              <tr key={skill.skillID}>
                <td><strong>{skill.displayName}</strong><div className="table-meta">{skill.skillID} · v{skill.version}</div></td>
                <td>{skill.publisherName}<br /><span className="table-meta">{skill.departmentName}</span></td>
                <td><TagPill tone="info">{skill.status}</TagPill></td>
                <td><span className="table-meta">Star {skill.starCount} · 下载 {skill.downloadCount}</span></td>
                <td>
                  <div className="inline-actions wrap">
                    {skill.status === "published" ? (
                      <button
                        className="btn btn-small"
                        onClick={() => ui.openConfirm({
                          title: `下架 ${skill.displayName}`,
                          body: "下架后市场不再对新用户提供安装，已安装用户继续保留当前本地副本。",
                          confirmLabel: "确认下架",
                          tone: "danger",
                          detailLines: [`当前状态：${skill.status}`],
                          onConfirm: async () => {
                            ui.closeModal();
                            await workspace.adminData.delistAdminSkill(skill.skillID);
                          },
                        })}
                      >
                        下架
                      </button>
                    ) : null}
                    {skill.status === "delisted" ? (
                      <button
                        className="btn btn-small"
                        onClick={() => ui.openConfirm({
                          title: `上架 ${skill.displayName}`,
                          body: "上架后恢复市场可见与安装资格，仍按当前权限配置生效。",
                          confirmLabel: "确认上架",
                          tone: "primary",
                          detailLines: [`当前状态：${skill.status}`],
                          onConfirm: async () => {
                            ui.closeModal();
                            await workspace.adminData.relistAdminSkill(skill.skillID);
                          },
                        })}
                      >
                        上架
                      </button>
                    ) : null}
                    {skill.status !== "archived" ? (
                      <button
                        className="btn btn-danger btn-small"
                        onClick={() => ui.openConfirm({
                          title: `归档 ${skill.displayName}`,
                          body: "归档后该 Skill 不可再次上架，请确认不再作为活跃 Skill 维护。",
                          confirmLabel: "确认归档",
                          tone: "danger",
                          detailLines: [`当前状态：${skill.status}`],
                          onConfirm: async () => {
                            ui.closeModal();
                            await workspace.adminData.archiveAdminSkill(skill.skillID);
                          },
                        })}
                      >
                        <Archive size={14} />归档
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
