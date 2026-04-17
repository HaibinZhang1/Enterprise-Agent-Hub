import { Bell, Download, RefreshCw, ShieldCheck } from "lucide-react";
import type { DesktopUIState } from "../state/useDesktopUIState.ts";
import type { DesktopNotificationItem } from "../state/ui/desktopNotifications.ts";
import { formatDate, localize } from "./desktopShared.tsx";

function notificationKindIcon(kind: DesktopNotificationItem["kind"]) {
  switch (kind) {
    case "review_progress":
      return <ShieldCheck size={16} />;
    case "skill_update":
      return <RefreshCw size={16} />;
    case "app_update":
      return <Download size={16} />;
  }
}

function notificationKindLabel(kind: DesktopNotificationItem["kind"], ui: DesktopUIState) {
  switch (kind) {
    case "review_progress":
      return localize(ui.language, "审核进度", "Review Progress");
    case "skill_update":
      return localize(ui.language, "Skill 更新", "Skill Update");
    case "app_update":
      return localize(ui.language, "软件更新", "App Update");
  }
}

export function NotificationListRow({
  notification,
  onSelect,
  ui
}: {
  notification: DesktopNotificationItem;
  onSelect: (notification: DesktopNotificationItem) => void;
  ui: DesktopUIState;
}) {
  return (
    <button className={notification.unread ? "notification-entry unread" : "notification-entry"} type="button" onClick={() => onSelect(notification)}>
      <span className="notification-entry-icon">{notificationKindIcon(notification.kind)}</span>
      <span className="notification-entry-main">
        <span className="notification-entry-top">
          <strong>{notification.title}</strong>
          {notification.unread ? <span className="notification-unread-dot" aria-hidden="true" /> : null}
        </span>
        <small>{notification.summary}</small>
        <span className="notification-entry-meta">
          <small>{notificationKindLabel(notification.kind, ui)}</small>
          <small>{formatDate(notification.occurredAt, ui.language)}</small>
        </span>
      </span>
    </button>
  );
}

export function NotificationPopover({
  ui,
  onSelect
}: {
  ui: DesktopUIState;
  onSelect: (notification: DesktopNotificationItem) => void;
}) {
  return (
    <section className="notification-popover" role="dialog" aria-modal="false" aria-label={localize(ui.language, "通知", "Notifications")}>
      <div className="notification-popover-head">
        <div>
          <div className="eyebrow">{localize(ui.language, "全局消息", "Global Updates")}</div>
          <h2>{localize(ui.language, "通知", "Notifications")}</h2>
        </div>
        <Bell size={16} />
      </div>
      <div className="notification-popover-toolbar">
        <div className="inline-actions">
          <button className={ui.notificationFilter === "all" ? "btn btn-primary btn-small" : "btn btn-small"} type="button" onClick={() => ui.setNotificationFilter("all")}>
            {localize(ui.language, "全部", "All")}
          </button>
          <button className={ui.notificationFilter === "unread" ? "btn btn-primary btn-small" : "btn btn-small"} type="button" onClick={() => ui.setNotificationFilter("unread")}>
            {localize(ui.language, "未读", "Unread")}
          </button>
        </div>
        <button className="btn btn-small" type="button" onClick={() => void ui.markAllNotificationsRead()}>
          {localize(ui.language, "全部已读", "Mark All Read")}
        </button>
      </div>

      {ui.visibleNotifications.length === 0 ? (
        <div className="notification-empty">
          <strong>{localize(ui.language, "暂无通知", "No Notifications")}</strong>
          <small>{localize(ui.language, "审核进度、Skill 更新和软件更新会出现在这里。", "Review progress, skill updates, and app updates will appear here.")}</small>
        </div>
      ) : (
        <div className="notification-list">
          {ui.visibleNotifications.map((notification) => (
            <NotificationListRow key={notification.notificationID} notification={notification} onSelect={onSelect} ui={ui} />
          ))}
        </div>
      )}
    </section>
  );
}
