import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, CircleUserRound, LogIn, LogOut, Minus, Settings2, Square, X } from "lucide-react";
import { useP1Workspace } from "../state/useP1Workspace.ts";
import { type TopLevelSection, useDesktopUIState } from "../state/useDesktopUIState.ts";
import { deriveAccountPresentation } from "../state/ui/accountPresentation.ts";
import { InitialBadge } from "./pageCommon.tsx";
import { NotificationPopover } from "./NotificationPopover.tsx";
import { CommunitySection, HomeSection, LocalSection, ManageSection } from "./desktopSections.tsx";
import { DesktopOverlays, FlashToast } from "./desktopOverlays.tsx";
import { getInvoke } from "../services/tauriBridge/runtime.ts";

const sectionLabels: Record<TopLevelSection, string> = {
  home: "主页",
  community: "社区",
  local: "本地",
  manage: "管理"
};

function TopbarNotifications({ ui }: { ui: ReturnType<typeof useDesktopUIState> }) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    function handlePointerDown(event: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="topbar-popover-shell" ref={shellRef}>
      <button
        className={open ? "icon-button notification-bell active" : "icon-button notification-bell"}
        type="button"
        aria-label="打开通知"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} />
        {ui.notificationBadge ? <span className="notification-badge">{ui.notificationBadge}</span> : null}
      </button>
      {open ? <NotificationPopover ui={ui} onSelect={(notification) => { setOpen(false); void ui.openDesktopNotification(notification); }} /> : null}
    </div>
  );
}

function AvatarMenu({ workspace, ui }: { workspace: ReturnType<typeof useP1Workspace>; ui: ReturnType<typeof useDesktopUIState> }) {
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const account = deriveAccountPresentation({
    user: workspace.currentUser,
    loggedIn: workspace.loggedIn,
    connectionStatus: workspace.bootstrap.connection.status,
    language: ui.language
  });

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    function handlePointerDown(event: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="topbar-popover-shell account-launcher" ref={shellRef}>
      <InitialBadge label={workspace.currentUser.username} className="account-avatar-badge" />
      <button
        className={open ? "avatar-button active" : "avatar-button"}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="打开账号菜单"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="avatar-button-label">
          <span className={`avatar-status-dot ${account.connectionTone}`} />
          {account.buttonLabel}
        </span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="avatar-menu" aria-label="账号菜单">
          {workspace.loggedIn ? (
            <button className="menu-row account-menu-row" type="button" onClick={() => { setOpen(false); ui.openConnectionStatus(); }}>
              <span className="menu-row-icon"><CircleUserRound size={15} /></span>
              <span className="menu-row-copy">
                <strong>我的信息</strong>
                <small>身份、部门与服务状态</small>
              </span>
            </button>
          ) : null}
          <button className="menu-row account-menu-row" type="button" onClick={() => { setOpen(false); ui.openSettingsModal(); }}>
            <span className="menu-row-icon"><Settings2 size={15} /></span>
            <span className="menu-row-copy">
              <strong>设置</strong>
              <small>偏好、本地环境与关于信息</small>
            </span>
          </button>
          {workspace.loggedIn ? (
            <button className="menu-row account-menu-row" type="button" onClick={() => { setOpen(false); void workspace.logout(); }}>
              <span className="menu-row-icon"><LogOut size={15} /></span>
              <span className="menu-row-copy">
                <strong>退出登录</strong>
                <small>保留本地已安装数据</small>
              </span>
            </button>
          ) : (
            <button className="menu-row account-menu-row" type="button" onClick={() => { setOpen(false); workspace.setLoginModalOpen(true); }}>
              <span className="menu-row-icon"><LogIn size={15} /></span>
              <span className="menu-row-copy">
                <strong>登录</strong>
                <small>同步企业服务能力</small>
              </span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function WindowControls() {
  const minimize = () => {
    const invoke = getInvoke();
    if (invoke) void invoke("p1_window_minimize");
  };
  const maximize = () => {
    const invoke = getInvoke();
    if (invoke) void invoke("p1_window_maximize");
  };
  const close = () => {
    const invoke = getInvoke();
    if (invoke) void invoke("p1_window_close");
  };

  return (
    <div className="window-controls">
      <button className="window-control-button" type="button" onClick={minimize} aria-label="最小化">
        <Minus size={14} />
      </button>
      <button className="window-control-button" type="button" onClick={maximize} aria-label="最大化">
        <Square size={12} />
      </button>
      <button className="window-control-button close-button" type="button" onClick={close} aria-label="关闭">
        <X size={16} />
      </button>
    </div>
  );
}

function startWindowDragging() {
  const invoke = getInvoke();
  if (invoke) void invoke("p1_window_start_dragging");
}

function AppLogoMark() {
  return (
    <svg className="brand-badge-mark" viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <rect width="128" height="128" fill="#4f8f84" />
      <text
        x="64"
        y="64"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="48"
        fontWeight="800"
        letterSpacing="-2"
        fill="#ffd166"
      >
        EA
      </text>
    </svg>
  );
}

export function DesktopApp() {
  const workspace = useP1Workspace();
  const ui = useDesktopUIState(workspace);

  return (
    <div className="desktop-shell">
      <header
        className="desktop-topbar"
        onPointerDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          const target = e.target instanceof Element ? e.target : null;
          if (target?.closest("button, input, textarea, select, a, [role='button']")) {
            return;
          }
          startWindowDragging();
        }}
      >
        <div className="brand-lockup">
          <button className="brand-badge" type="button" onClick={ui.goHome} aria-label="回到主页">
            <AppLogoMark />
          </button>
          <div className="brand-copy">
            <strong>Enterprise Agent Hub</strong>
            <span>Desktop Skills Workspace</span>
          </div>
        </div>

        <nav className="segment-nav" aria-label="一级导航">
          {ui.navigationSections.map((section) => (
            <button
              key={section}
              data-testid={section === "community" ? "nav-market" : section === "local" ? "nav-my_installed" : section === "manage" ? "nav-review" : undefined}
              className={ui.activeSection === section ? "segment-button active" : "segment-button"}
              type="button"
              onClick={() => ui.navigateSection(section)}
            >
              {sectionLabels[section]}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <TopbarNotifications ui={ui} />
          <AvatarMenu workspace={workspace} ui={ui} />
          <div className="topbar-divider" />
          <WindowControls />
        </div>
      </header>

      <main className="desktop-stage">
        {ui.activeSection === "home" ? <HomeSection workspace={workspace} ui={ui} /> : null}
        {ui.activeSection === "community" ? <CommunitySection workspace={workspace} ui={ui} /> : null}
        {ui.activeSection === "local" ? <LocalSection workspace={workspace} ui={ui} /> : null}
        {ui.activeSection === "manage" ? <ManageSection workspace={workspace} ui={ui} /> : null}
      </main>

      <DesktopOverlays workspace={workspace} ui={ui} />
      <FlashToast flash={ui.flash} onClear={ui.clearFlash} />
    </div>
  );
}
