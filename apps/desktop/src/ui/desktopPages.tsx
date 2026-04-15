import { MyInstalledPage } from "./pages/MyInstalledPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { ManagePage } from "./pages/ManagePage.tsx";
import { MarketPage, SkillDetailPanel } from "./pages/MarketPage.tsx";
import { NotificationsPage } from "./pages/NotificationsPage.tsx";
import { ProjectsPage } from "./pages/ProjectsPage.tsx";
import { ReviewPage } from "./pages/ReviewPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { ToolsPage } from "./pages/ToolsPage.tsx";
import { PageProps, SectionEmpty } from "./pages/pageCommon.tsx";

export function ActivePageContent({ workspace, ui }: PageProps) {
  switch (ui.activePage) {
    case "home":
      return <HomePage workspace={workspace} ui={ui} />;
    case "market":
      return <MarketPage workspace={workspace} ui={ui} />;
    case "detail":
      return ui.visibleSkillDetail ? <SkillDetailPanel skill={ui.visibleSkillDetail} workspace={workspace} ui={ui} standalone /> : <SectionEmpty title="没有找到这个 Skill" body="返回市场重新选择。" />;
    case "my_installed":
      return <MyInstalledPage workspace={workspace} ui={ui} />;
    case "review":
      return <ReviewPage workspace={workspace} ui={ui} />;
    case "manage":
      return <ManagePage workspace={workspace} ui={ui} />;
    case "tools":
      return <ToolsPage workspace={workspace} ui={ui} />;
    case "projects":
      return <ProjectsPage workspace={workspace} ui={ui} />;
    case "notifications":
      return <NotificationsPage workspace={workspace} ui={ui} />;
    case "settings":
      return <SettingsPage workspace={workspace} ui={ui} />;
    default:
      return null;
  }
}
