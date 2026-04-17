import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { flattenDepartments } from "../desktopShared.tsx";
import { AuthGateCard, PageProps, SelectField, TagPill } from "./pageCommon.tsx";

export function AdminUsersPage({ workspace }: PageProps) {
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    displayName: "",
    departmentID: "",
    role: "normal_user" as "normal_user" | "admin",
    adminLevel: "4",
  });
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null);
  const selectedUser = workspace.adminData.adminUsers.find((user) => user.userID === selectedUserID) ?? workspace.adminData.adminUsers[0] ?? null;

  useEffect(() => {
    setSelectedUserID((current) => (workspace.adminData.adminUsers.some((user) => user.userID === current) ? current : workspace.adminData.adminUsers[0]?.userID ?? null));
  }, [workspace.adminData.adminUsers]);

  useEffect(() => {
    setNewUser((current) => ({
      ...current,
      departmentID: current.departmentID || workspace.adminData.selectedDepartment?.departmentID || workspace.adminData.departments[0]?.departmentID || "",
    }));
  }, [workspace.adminData.departments, workspace.adminData.selectedDepartment]);

  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("admin_users")) {
    return <AuthGateCard title="用户管理仅对在线管理员开放" body="登录并保持连接后，可创建、冻结、删除或调整用户角色。" onLogin={() => workspace.requireAuth("admin_users")} />;
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
      adminLevel: newUser.role === "admin" ? Number(newUser.adminLevel) : null,
    });
  }

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">管理员视角</div>
          <h1>用户管理</h1>
          <p>创建账号、调整角色与冻结状态；写操作仍走服务端真实鉴权。</p>
        </div>
        <TagPill tone="info">{workspace.adminData.adminUsers.length} 个用户</TagPill>
      </section>

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
          <div className="section-heading">
            <div>
              <div className="eyebrow">账号列表</div>
              <h2>用户</h2>
            </div>
          </div>
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
    </div>
  );
}
