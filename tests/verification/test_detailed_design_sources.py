from pathlib import Path
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
DETAILED_DESIGN_ROOT = REPO_ROOT / "docs" / "DetailedDesign"


REQUIRED_DESIGN_FILES = [
    "README.md",
    "architecture/01_system_architecture.md",
    "backend/00_backend_architecture.md",
    "backend/README.md",
    "backend/audit.md",
    "backend/auth.md",
    "backend/install.md",
    "backend/notify.md",
    "backend/org.md",
    "backend/package.md",
    "backend/review.md",
    "backend/search.md",
    "backend/skill.md",
    "auth/README.md",
    "auth/01_auth_module_detailed_design.md",
    "auth/02_auth_error_contract.md",
    "data/01_data_architecture.md",
    "deployment/01_deployment_architecture.md",
    "desktop/README.md",
    "desktop/00_desktop_architecture.md",
    "desktop/conflict-resolver.md",
    "desktop/desktop-notify.md",
    "desktop/local-state.md",
    "desktop/project-manager.md",
    "desktop/skill-sync.md",
    "desktop/tool-scanner.md",
    "desktop/updater.md",
    "frontend-pages/README.md",
    "frontend-pages/department-management.md",
    "frontend-pages/home.md",
    "frontend-pages/market.md",
    "frontend-pages/my-skill.md",
    "frontend-pages/notifications.md",
    "frontend-pages/projects.md",
    "frontend-pages/review.md",
    "frontend-pages/settings.md",
    "frontend-pages/skill-management.md",
    "frontend-pages/tools.md",
    "frontend-pages/user-management.md",
]


class DetailedDesignSourceTests(unittest.TestCase):
    def read_doc(self, relative_path: str) -> str:
        return (DETAILED_DESIGN_ROOT / relative_path).read_text(encoding="utf-8")

    def test_required_detailed_design_files_exist(self) -> None:
        missing_files = [
            relative_path
            for relative_path in REQUIRED_DESIGN_FILES
            if not (DETAILED_DESIGN_ROOT / relative_path).is_file()
        ]
        self.assertEqual(
            missing_files,
            [],
            f"Missing required detailed-design files: {missing_files}",
        )

    def test_readme_declares_all_core_backend_domains(self) -> None:
        readme = self.read_doc("README.md")
        for module_name in (
            "auth",
            "org",
            "skill",
            "package",
            "review",
            "install",
            "search",
            "notify",
            "audit",
        ):
            with self.subTest(module_name=module_name):
                self.assertIn(module_name, readme)

    def test_system_architecture_keeps_four_layer_contract(self) -> None:
        architecture_doc = self.read_doc("architecture/01_system_architecture.md")
        for required_snippet in (
            "REST + SSE",
            "NestJS Domain Services",
            "PostgreSQL + File Volume + Local SQLite",
            "服务端是市场、审核、权限与版本的唯一权威源",
        ):
            with self.subTest(required_snippet=required_snippet):
                self.assertIn(required_snippet, architecture_doc)

    def test_auth_error_contract_keeps_pending_and_version_mismatch_codes(self) -> None:
        error_contract = self.read_doc("auth/02_auth_error_contract.md")
        for required_code in (
            "AUTHZ_VERSION_MISMATCH",
            "AUTHZ_RECALC_PENDING",
            "AUTH_REFRESH_REUSE_DETECTED",
            "requestId",
        ):
            with self.subTest(required_code=required_code):
                self.assertIn(required_code, error_contract)

    def test_desktop_local_state_stays_non_authoritative(self) -> None:
        local_state_doc = self.read_doc("desktop/local-state.md")
        for required_snippet in (
            "不存 refresh token",
            "不作为服务端权限权威源",
            "schema version",
        ):
            with self.subTest(required_snippet=required_snippet):
                self.assertIn(required_snippet, local_state_doc)

    def test_search_design_requires_filter_before_rank(self) -> None:
        search_doc = self.read_doc("backend/search.md")
        for required_snippet in (
            "FTS 索引维护",
            "权限过滤后的搜索结果生成",
            "先权限过滤后排序",
        ):
            with self.subTest(required_snippet=required_snippet):
                self.assertIn(required_snippet, search_doc)


if __name__ == "__main__":
    unittest.main()
