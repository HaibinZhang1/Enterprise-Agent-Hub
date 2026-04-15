import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Archive, ChevronRight, Plus, UserPlus } from "lucide-react";
import { flattenDepartments } from "../desktopShared.tsx";
import { AuthGateCard, PageProps, SectionEmpty, SelectField, TagPill } from "./pageCommon.tsx";

function DepartmentTree({
  nodes,
  selectedDepartmentID,
  onSelect
}: {
  nodes: PageProps["workspace"]["adminData"]["departments"];
  selectedDepartmentID: string | null;
  onSelect: (departmentID: string) => void;
}) {
  return (
    <div className="tree-list">
      {nodes.map((node) => (
        <div className="tree-node" key={node.departmentID}>
          <button className={selectedDepartmentID === node.departmentID ? "tree-button selected" : "tree-button"} onClick={() => onSelect(node.departmentID)}>
            <ChevronRight size={14} />
            <span>{node.name}</span>
            <small>{node.userCount}</small>
          </button>
          {node.children.length > 0 ? <div className="tree-children"><DepartmentTree nodes={node.children} selectedDepartmentID={selectedDepartmentID} onSelect={onSelect} /></div> : null}
        </div>
      ))}
    </div>
  );
}

export function ManagePage({ workspace, ui }: PageProps) {
  const [createDepartmentName, setCreateDepartmentName] = useState("");
  const [renameDepartmentName, setRenameDepartmentName] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    displayName: "",
    departmentID: "",
    role: "normal_user" as "normal_user" | "admin",
    adminLevel: "4"
  });
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null);

  const selectedDepartment = workspace.adminData.selectedDepartment;
  const selectedUser = workspace.adminData.adminUsers.find((user) => user.userID === selectedUserID) ?? workspace.adminData.adminUsers[0] ?? null;

  useEffect(() => {
    setSelectedUserID((current) => (workspace.adminData.adminUsers.some((user) => user.userID === current) ? current : workspace.adminData.adminUsers[0]?.userID ?? null));
  }, [workspace.adminData.adminUsers]);

  useEffect(() => {
    if (!selectedDepartment) return;
    setRenameDepartmentName(selectedDepartment.name);
    setNewUser((current) => ({ ...current, departmentID: current.departmentID || selectedDepartment.departmentID }));
  }, [selectedDepartment]);

  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("manage")) {
    return <AuthGateCard title="管理仅对在线管理员开放" body="登录并与服务端保持连接后，可管理部门、用户和 Skill 状态。" onLogin={() => workspace.requireAuth("manage")} />;
  }

  function submitDepartmentCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDepartment || createDepartmentName.trim().length === 0) return;
    void workspace.adminData.createDepartment(selectedDepartment.departmentID, createDepartmentName.trim());
    setCreateDepartmentName("");
  }

  function submitDepartmentRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDepartment || renameDepartmentName.trim().length === 0) return;
    void workspace.adminData.updateDepartment(selectedDepartment.departmentID, renameDepartmentName.trim());
  }

  function submitCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newUser.departmentID || !newUser.username.trim() || !newUser.displayName.trim()) return;
    void workspace.adminData.createAdminUser({
      username: newUser.username.trim(),
      password: newUser.password,
      displayName: newUser.displayName.trim(),
      departmentID: newUser.departmentID,
      role: newUser.role,
      adminLevel: newUser.role === "admin" ? Number(newUser.adminLevel) : null
    });
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">管理中心</div>
          <h1>治理工作台</h1>
          <p>管理员管理本部门及后代部门；真实写操作继续走后端，未接入动作不伪造成功结果。</p>
        </div>
        <TagPill tone="info">自建账号体系</TagPill>
      </section>

      <div className="inline-actions wrap">
        {(["departments", "users", "skills"] as const).map((section) => (
          <button key={section} className={workspace.adminData.manageSection === section ? "btn btn-primary" : "btn"} onClick={() => workspace.adminData.setManageSection(section)}>
            {section === "departments" ? "部门管理" : section === "users" ? "用户管理" : "Skill 管理"}
          </button>
        ))}
      </div>

      {workspace.adminData.manageSection === "departments" ? (
        <div className="page-grid two-up">
          <section className="panel">
            <div className="section-heading"><h2>部门树</h2></div>
            <DepartmentTree nodes={workspace.adminData.departments} selectedDepartmentID={selectedDepartment?.departmentID ?? null} onSelect={workspace.adminData.setSelectedDepartmentID} />
          </section>
          <section className="panel">
            {!selectedDepartment ? <SectionEmpty title="选择部门查看详情" body="右侧会展示路径、人数、Skill 数和管理动作。" /> : (
              <>
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">详情面板</div>
                    <h2>{selectedDepartment.name}</h2>
                  </div>
                  <TagPill tone="info">L{selectedDepartment.level}</TagPill>
                </div>
                <div className="definition-grid split">
                  <div><dt>路径</dt><dd>{selectedDepartment.path}</dd></div>
                  <div><dt>用户数</dt><dd>{selectedDepartment.userCount}</dd></div>
                  <div><dt>Skill 数</dt><dd>{selectedDepartment.skillCount}</dd></div>
                  <div><dt>状态</dt><dd>{selectedDepartment.status}</dd></div>
                </div>
                <form className="inline-form" onSubmit={submitDepartmentCreate}>
                  <input value={createDepartmentName} onChange={(event) => setCreateDepartmentName(event.target.value)} placeholder="新增下级部门" />
                  <button className="btn btn-primary" type="submit"><Plus size={15} />新增</button>
                </form>
                {selectedDepartment.level > 0 ? (
                  <form className="inline-form" onSubmit={submitDepartmentRename}>
                    <input value={renameDepartmentName} onChange={(event) => setRenameDepartmentName(event.target.value)} />
                    <button className="btn" type="submit">保存</button>
                    <button className="btn btn-danger" type="button" onClick={() => void workspace.adminData.deleteDepartment(selectedDepartment.departmentID)}>删除</button>
                  </form>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}

      {workspace.adminData.manageSection === "users" ? (
        <div className="page-grid two-up">
          <section className="panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">账号开通</div>
                <h2>新增用户</h2>
              </div>
              <UserPlus size={18} />
            </div>
            <form className="form-stack" onSubmit={submitCreateUser}>
              <label className="field"><span>用户名</span><input value={newUser.username} onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))} /></label>
              <label className="field"><span>显示名</span><input value={newUser.displayName} onChange={(event) => setNewUser((current) => ({ ...current, displayName: event.target.value }))} /></label>
              <label className="field"><span>初始密码</span><input value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} /></label>
              <label className="field">
                <span>所属部门</span>
                <select value={newUser.departmentID} onChange={(event) => setNewUser((current) => ({ ...current, departmentID: event.target.value }))}>
                  {flattenDepartments(workspace.adminData.departments).map((department) => (
                    <option key={department.departmentID} value={department.departmentID}>{department.path}</option>
                  ))}
                </select>
              </label>
              <SelectField label="角色" value={newUser.role} options={["normal_user", "admin"]} onChange={(value) => setNewUser((current) => ({ ...current, role: value as "normal_user" | "admin" }))} />
              {newUser.role === "admin" ? <label className="field"><span>管理员等级</span><input value={newUser.adminLevel} onChange={(event) => setNewUser((current) => ({ ...current, adminLevel: event.target.value }))} /></label> : null}
              <button className="btn btn-primary" type="submit">创建用户</button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading"><h2>用户列表</h2></div>
            <div className="stack-list">
              {workspace.adminData.adminUsers.map((user) => (
                <button key={user.userID} className={selectedUser?.userID === user.userID ? "admin-list-row selected" : "admin-list-row"} onClick={() => setSelectedUserID(user.userID)}>
                  <span>
                    <strong>{user.displayName}</strong>
                    <small>{user.departmentName} · {user.username}</small>
                  </span>
                  <TagPill tone={user.status === "active" ? "success" : "warning"}>{user.role === "admin" ? `管理员 L${user.adminLevel}` : "普通用户"}</TagPill>
                </button>
              ))}
            </div>
            {selectedUser ? (
              <div className="detail-block">
                <h3>用户操作</h3>
                <div className="inline-actions wrap">
                  <button className="btn" onClick={() => void workspace.adminData.updateAdminUser(selectedUser.userID, { role: "normal_user", adminLevel: null })}>设为普通用户</button>
                  <button className="btn" onClick={() => void workspace.adminData.updateAdminUser(selectedUser.userID, { role: "admin", adminLevel: selectedUser.adminLevel ?? 3 })}>设为管理员</button>
                  {selectedUser.status === "frozen" ? (
                    <button className="btn" onClick={() => void workspace.adminData.unfreezeAdminUser(selectedUser.userID)}>解冻</button>
                  ) : (
                    <button className="btn" onClick={() => void workspace.adminData.freezeAdminUser(selectedUser.userID)}>冻结</button>
                  )}
                  <button className="btn btn-danger" onClick={() => void workspace.adminData.deleteAdminUser(selectedUser.userID)}>删除</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {workspace.adminData.manageSection === "skills" ? (
        <section className="panel">
          <div className="section-heading"><h2>Skill 管理</h2></div>
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
                            }
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
                            }
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
                            }
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
      ) : null}
    </div>
  );
}
