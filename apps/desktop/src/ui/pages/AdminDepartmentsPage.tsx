import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { AuthGateCard, PageProps, SectionEmpty, TagPill } from "./pageCommon.tsx";

function DepartmentTree({
  nodes,
  selectedDepartmentID,
  onSelect,
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
          {node.children.length > 0 ? (
            <div className="tree-children">
              <DepartmentTree nodes={node.children} selectedDepartmentID={selectedDepartmentID} onSelect={onSelect} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AdminDepartmentsPage({ workspace }: PageProps) {
  const [createDepartmentName, setCreateDepartmentName] = useState("");
  const [renameDepartmentName, setRenameDepartmentName] = useState("");
  const selectedDepartment = workspace.adminData.selectedDepartment;

  useEffect(() => {
    if (selectedDepartment) {
      setRenameDepartmentName(selectedDepartment.name);
    }
  }, [selectedDepartment]);

  if (!workspace.loggedIn || !workspace.visibleNavigation.includes("admin_departments")) {
    return <AuthGateCard title="部门管理仅对在线管理员开放" body="登录并保持连接后，可管理本部门与下级部门结构。" onLogin={() => workspace.requireAuth("admin_departments")} />;
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

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">管理员视角</div>
          <h1>部门管理</h1>
          <p>维护部门树、路径与可管理范围。当前仍沿用后端真实写入与范围校验。</p>
        </div>
        <TagPill tone="info">{workspace.adminData.departments.length} 个部门节点</TagPill>
      </section>

      <div className="page-grid two-up">
        <section className="panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">结构</div>
              <h2>部门树</h2>
            </div>
          </div>
          {workspace.adminData.departments.length === 0 ? <SectionEmpty title="暂无部门数据" body="连接服务后会加载可管理范围内的部门树。" /> : null}
          <DepartmentTree nodes={workspace.adminData.departments} selectedDepartmentID={selectedDepartment?.departmentID ?? null} onSelect={workspace.adminData.setSelectedDepartmentID} />
        </section>

        <section className="panel">
          {!selectedDepartment ? (
            <SectionEmpty title="选择部门查看详情" body="右侧会显示路径、人数、Skill 数和维护动作。" />
          ) : (
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
    </div>
  );
}
