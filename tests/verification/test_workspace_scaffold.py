from pathlib import Path
import json
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]


class WorkspaceScaffoldTests(unittest.TestCase):
    def test_workspace_files_exist(self) -> None:
        for relative_path in (
            "package.json",
            "pnpm-workspace.yaml",
            "tsconfig.json",
            "apps/api/src/manifest.js",
            "apps/web/src/manifest.js",
            "apps/desktop/src/manifest.js",
            "packages/contracts/src/index.js",
            "packages/migrations/src/index.js",
        ):
            with self.subTest(relative_path=relative_path):
                self.assertTrue((REPO_ROOT / relative_path).is_file(), f"Missing scaffold file: {relative_path}")

    def test_phase_gate_artifacts_exist(self) -> None:
        for relative_path in (
            "packages/contracts/fixtures/auth-error-envelope.fixture.json",
            "packages/contracts/fixtures/auth-org-convergence.fixture.json",
            "packages/contracts/fixtures/install-reconcile-status.fixture.json",
            "packages/contracts/fixtures/sse-payload.fixture.json",
            "packages/contracts/fixtures/source-of-truth-matrix.fixture.json",
            "packages/contracts/fixtures/phase-gates.fixture.json",
            "packages/contracts/fixtures/contract-ownership.fixture.json",
        ):
            with self.subTest(relative_path=relative_path):
                self.assertTrue((REPO_ROOT / relative_path).is_file(), f"Missing phase-gate artifact: {relative_path}")

    def test_phase_gate_sequence_is_foundation_then_contract_freeze(self) -> None:
        fixture_path = REPO_ROOT / "packages/contracts/fixtures/phase-gates.fixture.json"
        data = json.loads(fixture_path.read_text(encoding="utf-8"))
        self.assertEqual(
            [entry["gate"] for entry in data],
            ["gate-0-foundation", "gate-0.5-contract-freeze"],
        )

    def test_contract_ownership_uses_packages_contracts_as_canonical_source(self) -> None:
        fixture_path = REPO_ROOT / "packages/contracts/fixtures/contract-ownership.fixture.json"
        data = json.loads(fixture_path.read_text(encoding="utf-8"))
        self.assertGreater(len(data), 0)
        for entry in data:
            with self.subTest(contract=entry["contract"]):
                self.assertTrue(entry["canonicalSource"].startswith("packages/contracts/src/"))
                self.assertTrue(entry["fixture"].startswith("packages/contracts/fixtures/"))
                self.assertGreater(len(entry["consumers"]), 0)


if __name__ == "__main__":
    unittest.main()
