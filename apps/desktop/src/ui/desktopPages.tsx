import { AdminDepartmentsPage } from "./pages/AdminDepartmentsPage.tsx";
import { AdminSkillsPage } from "./pages/AdminSkillsPage.tsx";
import { AdminUsersPage } from "./pages/AdminUsersPage.tsx";
import { MyInstalledPage } from "./pages/MyInstalledPage.tsx";
import { PublisherWorkbenchPage } from "./pages/PublisherWorkbenchPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { MarketPage } from "./pages/MarketPage.tsx";
import { ReviewPage } from "./pages/ReviewPage.tsx";
import { TargetManagementPage } from "./pages/TargetManagementPage.tsx";
import { PageProps } from "./pages/pageCommon.tsx";

export function ActivePageContent({ workspace, ui }: PageProps) {
  switch (ui.activePage) {
    case "home":
      return <HomePage workspace={workspace} ui={ui} />;
    case "market":
      return <MarketPage workspace={workspace} ui={ui} />;

    case "my_installed":
      return <MyInstalledPage workspace={workspace} ui={ui} />;
    case "publisher":
      return <PublisherWorkbenchPage workspace={workspace} ui={ui} />;
    case "review":
      return <ReviewPage workspace={workspace} ui={ui} />;
    case "admin_departments":
      return <AdminDepartmentsPage workspace={workspace} ui={ui} />;
    case "admin_users":
      return <AdminUsersPage workspace={workspace} ui={ui} />;
    case "admin_skills":
      return <AdminSkillsPage workspace={workspace} ui={ui} />;
    case "target_management":
      return <TargetManagementPage workspace={workspace} ui={ui} />;
    default:
      return null;
  }
}
