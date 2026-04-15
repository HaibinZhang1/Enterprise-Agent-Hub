import { AlertTriangle, CircleGauge } from "lucide-react";
import { formatDate, localize, notificationSourceLabel } from "../desktopShared.tsx";
import { PageProps, SectionEmpty } from "./pageCommon.tsx";

export function NotificationsPage({ workspace, ui }: PageProps) {
  const offline = workspace.bootstrap.connection.status === "offline" || workspace.bootstrap.connection.status === "failed";
  const openNotificationTarget = (notice: PageProps["workspace"]["notifications"][number]) => {
    if (notice.targetPage === "detail" && notice.relatedSkillID) {
      ui.openSkillDetail(notice.relatedSkillID, "notifications");
      return;
    }
    ui.navigate(notice.targetPage === "detail" ? "notifications" : notice.targetPage);
  };

  return (
    <div className="page-stack">
      <section className="page-head">
        <div>
          <div className="eyebrow">{localize(ui.language, "应用内消息中心", "Inbox")}</div>
          <h1>{localize(ui.language, "通知", "Notifications")}</h1>
          <p>{workspace.loggedIn
            ? localize(ui.language, "服务端通知、本地事件同步结果和未读状态在这里统一汇总。", "Server notifications, local event sync results, and unread state are shown here.")
            : localize(ui.language, "这里保留本机通知和最近一次同步下来的缓存消息。", "This view keeps local notifications and the most recently synced cached messages.")}</p>
        </div>
        <div className="inline-actions wrap">
          <button className={ui.notificationFilter === "all" ? "btn btn-primary" : "btn"} onClick={() => ui.setNotificationFilter("all")}>{localize(ui.language, "全部", "All")}</button>
          <button className={ui.notificationFilter === "unread" ? "btn btn-primary" : "btn"} onClick={() => ui.setNotificationFilter("unread")}>{localize(ui.language, "未读", "Unread")}</button>
          <button className="btn" onClick={() => void workspace.markNotificationsRead("all")}>{localize(ui.language, "全部已读", "Mark All Read")}</button>
          <button className="btn" onClick={() => void workspace.syncOfflineEvents()}>{localize(ui.language, `同步本地事件（${workspace.offlineEvents.length}）`, `Sync Local Events (${workspace.offlineEvents.length})`)}</button>
        </div>
      </section>

      {!workspace.loggedIn ? (
        <div className="callout info">
          <CircleGauge size={16} />
          <span>
            <strong>{localize(ui.language, "当前为本地模式", "Local Mode")}</strong>
            <small>{localize(ui.language, "登录后可继续同步真实服务端通知和离线事件。", "Sign in to continue syncing server notifications and offline events.")}</small>
          </span>
        </div>
      ) : null}

      {offline ? (
        <div className="callout warning">
          <AlertTriangle size={16} />
          <span>
            <strong>{localize(ui.language, "当前展示缓存通知", "Showing Cached Notifications")}</strong>
            <small>{localize(ui.language, "网络恢复后可重新同步服务端未读状态。", "Reconnect to refresh unread state from the server.")}</small>
          </span>
        </div>
      ) : null}

      {ui.filteredNotifications.length === 0 ? <SectionEmpty title={localize(ui.language, "暂无通知", "No Notifications")} body={localize(ui.language, "新的安装、更新、路径异常或连接状态会出现在这里。", "Install results, updates, path issues, and connection changes will appear here.")} /> : null}
      <div className="stack-list">
        {ui.filteredNotifications.map((notice) => (
          <button className={notice.unread ? "notice-row unread" : "notice-row"} key={notice.notificationID} onClick={() => { openNotificationTarget(notice); void workspace.markNotificationsRead([notice.notificationID]); }}>
            <span>
              <strong>{notice.title}</strong>
              <small>{notice.summary}</small>
            </span>
            <small>{notificationSourceLabel(notice.source, ui.language)} · {formatDate(notice.occurredAt, ui.language)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
