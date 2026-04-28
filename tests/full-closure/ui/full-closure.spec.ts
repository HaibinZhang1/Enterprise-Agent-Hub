import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const artifactDir = requiredEnv("EAH_FULL_CLOSURE_ARTIFACT_DIR");
const apiBaseURL = requiredEnv("EAH_FULL_CLOSURE_API_BASE_URL");
const outsiderCredentials = { phoneNumber: "13800000007", username: "赵六", password: "EAgentHub123!" };
const adminCredentials = { phoneNumber: "13800000004", username: "前端组管理员", password: "EAgentHub123!" };
const authorCredentials = { phoneNumber: "13800000001", username: "张三", password: "EAgentHub123!" };
const runSuffix = Date.now().toString(36);

test.describe.configure({ mode: "serial" });

test("happy path publishes same skill through review and exposes installable market artifact", async ({ browser, page }) => {
  const skillID = `closure-happy-${runSuffix}`;
  const displayName = `Closure Happy ${runSuffix}`;
  const version = "1.0.0";
  const packageDir = createSkillDirectory(skillID, version, "Happy path package");
  const zipPath = await zipPackageDir(packageDir, `${skillID}.zip`);

  try {
    await loginAs(page, authorCredentials);
    await openPublishTab(page);
    await publishSkill(page, {
      skillID,
      displayName,
      version,
      description: "Happy path full closure skill",
      visibility: "public_installable",
      zipPath,
      tags: "closure,happy",
      tools: "codex",
      systems: "macos,windows",
    });
    await expect(page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`)).toBeVisible();

    const adminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(adminPage, skillID, "Happy path approved");
    } finally {
      await adminPage.context().close();
    }

    await waitForMarketVisibility(skillID, authorCredentials);
    await page.reload();
    await page.getByTestId("nav-market").click();
    await page.getByLabel("搜索市场 Skill").fill(skillID);
    const card = page.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"]`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText(displayName);
    await card.locator(".skill-row-main").click();
    await expect(page.getByText(skillID, { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "安装", exact: true })).toBeVisible();

    writeArtifact("happy-path.json", {
      apiBaseURL,
      skillID,
      displayName,
      version,
      author: authorCredentials,
      reviewer: adminCredentials,
    });
  } finally {
    cleanupDir(packageDir);
    cleanupDir(path.dirname(zipPath));
  }
});

test("author and reviewer can preview package docs and author can delist relist archive", async ({ browser, page }) => {
  const skillID = `closure-govern-${runSuffix}`;
  const displayName = `Closure Govern ${runSuffix}`;
  const packageDir = createSkillDirectory(skillID, "1.0.0", "Governance package body");
  const zipPath = await zipPackageDir(packageDir, `${skillID}.zip`);

  try {
    await loginAs(page, authorCredentials);
    await openPublishTab(page);
    await publishSkill(page, {
      skillID,
      displayName,
      version: "1.0.0",
      description: "Governance preview skill",
      visibility: "public_installable",
      zipPath,
      tags: "closure,govern",
      tools: "codex",
      systems: "macos,windows",
    });

    const adminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(adminPage, skillID, "Governance approved");
      await expect(adminPage.getByTestId("package-file-list")).toContainText("SKILL.md");
      await expect(adminPage.getByTestId("package-file-preview")).toContainText(skillID);
      await adminPage.locator('[data-testid="package-file-row"][data-file-path="assets/notes.txt"]').click();
      await expect(adminPage.getByTestId("package-file-preview")).toContainText(`${skillID}:1.0.0`);
    } finally {
      await adminPage.context().close();
    }

    await waitForMarketVisibility(skillID, authorCredentials);
    await page.reload();
    await page.getByTestId("nav-market").click();
    await page.getByTestId("my-skills-published-tab").click();
    const publisherRow = page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`);
    await publisherRow.click();
    await expect(page.getByTestId("package-file-list")).toContainText("SKILL.md");
    await page.locator('[data-testid="package-file-row"][data-file-path="assets/notes.txt"]').click();
    await expect(page.getByTestId("package-file-preview")).toContainText(`${skillID}:1.0.0`);

    await publisherRow.getByRole("button", { name: "下架" }).click();
    await expect.poll(async () => marketResultCount(skillID, await loginToken(authorCredentials)), { timeout: 30_000 }).toBe(0);
    await expect(publisherRow.getByRole("button", { name: "上架" })).toBeVisible();

    await publisherRow.getByRole("button", { name: "上架" }).click();
    await expect.poll(async () => marketResultCount(skillID, await loginToken(authorCredentials)), { timeout: 30_000 }).toBeGreaterThan(0);
    await expect(publisherRow.getByRole("button", { name: "下架" })).toBeVisible();

    await publisherRow.getByRole("button", { name: "归档" }).click();
    await expect.poll(async () => marketResultCount(skillID, await loginToken(authorCredentials)), { timeout: 30_000 }).toBe(0);
    await expect(publisherRow.getByRole("button", { name: "下架" })).toHaveCount(0);
    await expect(publisherRow.getByRole("button", { name: "上架" })).toHaveCount(0);
  } finally {
    cleanupDir(packageDir);
    cleanupDir(path.dirname(zipPath));
  }
});

test("return and resubmit flow publishes after second review", async ({ browser, page }) => {
  const skillID = `closure-return-${runSuffix}`;
  const displayName = `Closure Return ${runSuffix}`;
  const firstDir = createSkillDirectory(skillID, "1.0.0", "Initial return package");
  const secondDir = createSkillDirectory(skillID, "1.0.0", "Resubmitted return package");

  try {
    await loginAs(page, authorCredentials);
    await openPublishTab(page);
    await publishSkill(page, {
      skillID,
      displayName,
      version: "1.0.0",
      description: "Return and resubmit skill",
      visibility: "public_installable",
      folderPath: firstDir,
      tags: "closure,return",
      tools: "codex",
      systems: "macos",
    });

    const adminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await returnReviewForSkill(adminPage, skillID, "Need more detail");
    } finally {
      await adminPage.context().close();
    }

    await page.reload();
    await page.getByTestId("nav-market").click();
    await page.getByTestId("my-skills-published-tab").click();
    await page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`).getByRole("button", { name: "重新提交" }).click();
    await page.getByTestId("publish-description").fill("Return and resubmit skill v2");
    await page.getByTestId("publish-changelog").fill("Resubmit after return");
    await replaceFolderSubmission(page, secondDir);
    await page.getByTestId("publish-submit").click();
    await expect(page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`)).toBeVisible();

    const secondAdminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(secondAdminPage, skillID, "Resubmitted version approved");
    } finally {
      await secondAdminPage.context().close();
    }

    await waitForMarketVisibility(skillID, authorCredentials);
    await page.reload();
    await page.getByTestId("nav-market").click();
    await page.getByLabel("搜索市场 Skill").fill(skillID);
    await expect(page.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"]`)).toBeVisible({ timeout: 30_000 });
  } finally {
    cleanupDir(firstDir);
    cleanupDir(secondDir);
  }
});

test("reject flow keeps skill out of market", async ({ browser, page }) => {
  const skillID = `closure-reject-${runSuffix}`;
  const displayName = `Closure Reject ${runSuffix}`;
  const packageDir = createSkillDirectory(skillID, "1.0.0", "Reject package");
  const zipPath = await zipPackageDir(packageDir, `${skillID}.zip`);

  try {
    await loginAs(page, authorCredentials);
    await openPublishTab(page);
    await publishSkill(page, {
      skillID,
      displayName,
      version: "1.0.0",
      description: "Reject-only skill",
      visibility: "public_installable",
      zipPath,
      tags: "closure,reject",
      tools: "codex",
      systems: "macos",
    });

    const adminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await rejectReviewForSkill(adminPage, skillID, "Rejected for closure coverage");
    } finally {
      await adminPage.context().close();
    }

    await page.getByTestId("nav-market").click();
    await page.getByLabel("搜索市场 Skill").fill(skillID);
    await expect(page.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"]`)).toHaveCount(0);
  } finally {
    cleanupDir(packageDir);
    cleanupDir(path.dirname(zipPath));
  }
});

test("permission change keeps old visibility until approval and switches after approval", async ({ browser, page }) => {
  const skillID = `closure-permission-${runSuffix}`;
  const displayName = `Closure Permission ${runSuffix}`;
  const packageDir = createSkillDirectory(skillID, "1.0.0", "Permission base package");
  const zipPath = await zipPackageDir(packageDir, `${skillID}.zip`);

  try {
    await loginAs(page, authorCredentials);
    await openPublishTab(page);
    await publishSkill(page, {
      skillID,
      displayName,
      version: "1.0.0",
      description: "Permission-change skill",
      visibility: "public_installable",
      scope: "all_employees",
      zipPath,
      tags: "closure,permission",
      tools: "codex",
      systems: "macos,windows",
    });

    const adminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(adminPage, skillID, "Base permission skill approved");
    } finally {
      await adminPage.context().close();
    }

    await waitForMarketVisibility(skillID, authorCredentials);
    await page.reload();

    const outsiderPage = await loginInNewContext(browser, outsiderCredentials);
    try {
      await outsiderPage.getByTestId("nav-market").click();
      await outsiderPage.getByLabel("搜索市场 Skill").fill(skillID);
      const beforeCard = outsiderPage.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"]`);
      await expect(beforeCard).toBeVisible();
      await beforeCard.locator(".skill-row-main").click();
      await expect(outsiderPage.getByRole("button", { name: "安装", exact: true })).toBeVisible();
    } finally {
      await outsiderPage.context().close();
    }

    await page.getByTestId("nav-market").click();
    await page.getByTestId("my-skills-published-tab").click();
    await page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`).getByRole("button", { name: "修改权限" }).click();
    await page.getByTestId("publish-description").fill("Permission-change skill");
    await page.getByLabel("授权范围").selectOption("current_department");
    await page.getByLabel("公开级别").selectOption("summary_visible");
    await page.getByTestId("publish-submit").click();
    await expect(page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`)).toBeVisible();

    const outsiderBeforeApproval = await loginInNewContext(browser, outsiderCredentials);
    try {
      await outsiderBeforeApproval.getByTestId("nav-market").click();
      await outsiderBeforeApproval.getByLabel("搜索市场 Skill").fill(skillID);
      const card = outsiderBeforeApproval.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"]`);
      await expect(card).toBeVisible();
      await card.locator(".skill-row-main").click();
      await expect(outsiderBeforeApproval.getByRole("button", { name: "安装", exact: true })).toBeVisible();
    } finally {
      await outsiderBeforeApproval.context().close();
    }

    const approvingAdminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(approvingAdminPage, skillID, "Permission narrowed");
    } finally {
      await approvingAdminPage.context().close();
    }

    const outsiderAfterApproval = await loginInNewContext(browser, outsiderCredentials);
    try {
      await outsiderAfterApproval.getByTestId("nav-market").click();
      await outsiderAfterApproval.getByLabel("搜索市场 Skill").fill(skillID);
      const card = outsiderAfterApproval.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"]`);
      await expect(card).toBeVisible();
      await card.locator(".skill-row-main").click();
      await expect(outsiderAfterApproval.getByRole("button", { name: "安装", exact: true })).toHaveCount(0);
      await expect(outsiderAfterApproval.getByText(skillID, { exact: false })).toBeVisible();
      await expect(outsiderAfterApproval.getByText("不可安装").first()).toBeVisible();
    } finally {
      await outsiderAfterApproval.context().close();
    }
  } finally {
    cleanupDir(packageDir);
    cleanupDir(path.dirname(zipPath));
  }
});

test("update flow keeps v1 live before approval and exposes v2 after approval", async ({ browser, page }) => {
  const skillID = `closure-update-${runSuffix}`;
  const displayName = `Closure Update ${runSuffix}`;
  const v1Dir = createSkillDirectory(skillID, "1.0.0", "Update base package");
  const v2Dir = createSkillDirectory(skillID, "1.1.0", "Updated package content");
  const v1Zip = await zipPackageDir(v1Dir, `${skillID}-1.0.0.zip`);
  const v2Zip = await zipPackageDir(v2Dir, `${skillID}-1.1.0.zip`);

  try {
    await loginAs(page, authorCredentials);
    await openPublishTab(page);
    await publishSkill(page, {
      skillID,
      displayName,
      version: "1.0.0",
      description: "Update validation skill",
      visibility: "public_installable",
      zipPath: v1Zip,
      tags: "closure,update",
      tools: "codex",
      systems: "macos,windows",
    });

    const adminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(adminPage, skillID, "v1 approved");
    } finally {
      await adminPage.context().close();
    }

    await waitForMarketVisibility(skillID, authorCredentials);
    await page.reload();
    await page.getByTestId("nav-market").click();
    await page.getByTestId("my-skills-published-tab").click();
    await page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`).getByRole("button", { name: "发布新版本" }).click();
    await page.getByTestId("publish-version").fill("1.1.0");
    await page.getByTestId("publish-description").fill("Update validation skill v1.1.0");
    await page.getByTestId("publish-changelog").fill("Ship v1.1.0");
    await page.getByTestId("publish-zip-input").setInputFiles(v2Zip);
    await page.getByTestId("publish-submit").click();
    await expect(page.locator(`[data-testid="publisher-skill-row"][data-skill-id="${skillID}"]`)).toBeVisible();

    await page.getByTestId("nav-market").click();
    await page.getByLabel("搜索市场 Skill").fill(skillID);
    const detailButton = page.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"] .skill-row-main`);
    await detailButton.click();
    await expect(page.getByText(/^v1\.0\.0$/).first()).toBeVisible();

    const approvingAdminPage = await loginInNewContext(browser, adminCredentials);
    try {
      await approveReviewForSkill(approvingAdminPage, skillID, "v1.1.0 approved");
    } finally {
      await approvingAdminPage.context().close();
    }

    await waitForMarketVisibility(skillID, authorCredentials);
    await page.reload();
    await page.getByTestId("nav-market").click();
    await page.getByLabel("搜索市场 Skill").fill(skillID);
    await page.locator(`[data-testid="market-skill-card"][data-skill-id="${skillID}"] .skill-row-main`).click();
    await expect(page.getByText(/^v1\.1\.0$/).first()).toBeVisible();

    writeArtifact("update-path.json", {
      apiBaseURL,
      skillID,
      displayName,
      version: "1.1.0",
      previousVersion: "1.0.0",
      author: authorCredentials,
    });
  } finally {
    cleanupDir(v1Dir);
    cleanupDir(v2Dir);
    cleanupDir(path.dirname(v1Zip));
    cleanupDir(path.dirname(v2Zip));
  }
});

async function loginAs(page: Page, credentials: { phoneNumber: string; username: string; password: string }) {
  await page.goto("/");
  const loginModal = page.getByTestId("login-modal");
  if (!(await loginModal.isVisible().catch(() => false))) {
    await page.getByTestId("open-login").click();
  }
  await page.getByTestId("login-server-url").fill(apiBaseURL);
  await page.getByTestId("login-phone-number").fill(credentials.phoneNumber);
  await page.getByTestId("login-password").fill(credentials.password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("button", { name: new RegExp(credentials.username) })).toBeVisible();
}

async function loginInNewContext(browser: Browser, credentials: { phoneNumber: string; username: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, credentials);
  return page;
}

async function refreshWorkspace(page: Page) {
  await page.getByRole("button", { name: "Refresh" }).click();
}

async function waitForMarketVisibility(skillID: string, credentials: { phoneNumber: string; username: string; password: string }) {
  const token = await loginToken(credentials);
  await expect
    .poll(async () => marketResultCount(skillID, token), { timeout: 30_000 })
    .toBeGreaterThan(0);
}

async function loginToken(credentials: { phoneNumber: string; username: string; password: string }) {
  const response = await fetch(`${apiBaseURL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phoneNumber: credentials.phoneNumber, password: credentials.password }),
  });
  if (!response.ok) {
    throw new Error(`loginToken failed: ${response.status} ${response.statusText}`);
  }
  const body = await response.json();
  return body.accessToken as string;
}

async function marketResultCount(skillID: string, accessToken: string) {
  const response = await fetch(`${apiBaseURL}/skills?q=${encodeURIComponent(skillID)}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    return 0;
  }
  const body = await response.json();
  return Array.isArray(body.items) ? body.items.length : 0;
}

async function openPublishTab(page: Page) {
  await page.getByTestId("nav-market").click();
  await page.getByTestId("my-skills-publish-tab").click();
  await expect(page.getByTestId("publish-form")).toBeVisible();
}

async function publishSkill(page: Page, input: {
  skillID: string;
  displayName: string;
  version: string;
  description: string;
  visibility: string;
  scope?: string;
  zipPath?: string;
  folderPath?: string;
  tags: string;
  tools: string;
  systems: string;
}) {
  await page.getByTestId("publish-skill-id").fill(input.skillID);
  await page.getByTestId("publish-display-name").fill(input.displayName);
  await page.getByTestId("publish-description").fill(input.description);
  await page.getByTestId("publish-version").fill(input.version);
  await page.getByTestId("publish-changelog").fill(`Ship ${input.version}`);
  if (input.scope) {
    await page.getByLabel("授权范围").selectOption(input.scope);
  }
  await page.getByLabel("公开级别").selectOption(input.visibility);
  await page.getByTestId("publish-category").selectOption("开发");
  const tagPicker = page.getByTestId("publish-tags");
  await tagPicker.getByRole("button", { name: "代码", exact: true }).click();
  await tagPicker.getByRole("button", { name: "审查", exact: true }).click();
  await page.getByTestId("publish-tools").fill(input.tools);
  await page.getByTestId("publish-systems").fill(input.systems);
  if (input.zipPath) {
    await page.getByTestId("publish-zip-input").setInputFiles(input.zipPath);
  }
  if (input.folderPath) {
    await page.getByTestId("publish-folder-input").setInputFiles(input.folderPath);
  }
  await page.getByTestId("publish-submit").click();
}

async function replaceFolderSubmission(page: Page, folderPath: string) {
  await expect(page.getByTestId("publish-form")).toBeVisible();
  await page.getByTestId("publish-folder-input").setInputFiles(folderPath);
}

async function approveReviewForSkill(page: Page, skillID: string, comment: string) {
  await page.getByTestId("nav-review").click();
  const row = await waitForReviewRow(page, skillID);
  await row.click();
  await page.getByTestId("review-action-claim").click();
  await page.getByTestId("review-comment").fill(comment);
  const passPrecheck = page.getByTestId("review-action-pass_precheck");
  if (await passPrecheck.isVisible().catch(() => false)) {
    await passPrecheck.click();
    const claimedRow = await waitForReviewRow(page, skillID);
    const rowText = (await claimedRow.textContent()) ?? "";
    if (rowText.includes("待管理员审核")) {
      await claimedRow.click();
      await page.getByTestId("review-action-claim").click();
      await page.getByTestId("review-comment").fill(comment);
    }
  }
  await page.getByTestId("review-action-approve").click();
  await expect(page.getByTestId("review-detail-panel")).toContainText("已发布");
}

async function returnReviewForSkill(page: Page, skillID: string, comment: string) {
  await page.getByTestId("nav-review").click();
  const row = await waitForReviewRow(page, skillID);
  await row.click();
  await page.getByTestId("review-action-claim").click();
  await page.getByTestId("review-comment").fill(comment);
  const passPrecheck = page.getByTestId("review-action-pass_precheck");
  if (await passPrecheck.isVisible().catch(() => false)) {
    await passPrecheck.click();
    const claimedRow = await waitForReviewRow(page, skillID);
    const rowText = (await claimedRow.textContent()) ?? "";
    if (rowText.includes("待管理员审核")) {
      await claimedRow.click();
      await page.getByTestId("review-action-claim").click();
      await page.getByTestId("review-comment").fill(comment);
    }
  }
  await page.getByTestId("review-action-return_for_changes").click();
  await expect(page.getByTestId("review-action-return_for_changes")).toHaveCount(0);
  await expect(page.getByTestId("review-detail-panel")).toContainText("退回修改");
}

async function rejectReviewForSkill(page: Page, skillID: string, comment: string) {
  await page.getByTestId("nav-review").click();
  const row = await waitForReviewRow(page, skillID);
  await row.click();
  await page.getByTestId("review-action-claim").click();
  await page.getByTestId("review-comment").fill(comment);
  const passPrecheck = page.getByTestId("review-action-pass_precheck");
  if (await passPrecheck.isVisible().catch(() => false)) {
    await passPrecheck.click();
    const claimedRow = await waitForReviewRow(page, skillID);
    const rowText = (await claimedRow.textContent()) ?? "";
    if (rowText.includes("待管理员审核")) {
      await claimedRow.click();
      await page.getByTestId("review-action-claim").click();
      await page.getByTestId("review-comment").fill(comment);
    }
  }
  await page.getByTestId("review-action-reject").click();
  await expect(page.getByTestId("review-action-reject")).toHaveCount(0);
  await expect(page.getByTestId("review-detail-panel")).toContainText("审核拒绝");
}

async function waitForReviewRow(page: Page, skillID: string) {
  await expect.poll(async () => page.locator(`[data-testid="review-row"][data-skill-id="${skillID}"]`).count()).toBeGreaterThan(0);
  return page.locator(`[data-testid="review-row"][data-skill-id="${skillID}"]`).first();
}

async function reviewRowText(page: Page, skillID: string) {
  const row = page.locator(`[data-testid="review-row"][data-skill-id="${skillID}"]`).first();
  return (await row.textContent()) ?? "";
}

function workflowLabel(state: string) {
  return {
    pending_review: "待管理员审核",
    published: "已发布",
    returned_for_changes: "退回修改",
    review_rejected: "审核拒绝",
  }[state] ?? state;
}

function writeArtifact(fileName: string, value: unknown) {
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(path.join(artifactDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function createSkillDirectory(skillID: string, version: string, body: string) {
  const dir = path.join(os.tmpdir(), `${skillID}-${version}-${Date.now()}`);
  mkdirSync(path.join(dir, "assets"), { recursive: true });
  writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${skillID}\nversion: ${version}\n---\n# ${skillID}\n\n${body}\n`);
  writeFileSync(path.join(dir, "assets", "notes.txt"), `${skillID}:${version}\n`);
  return dir;
}

async function zipPackageDir(sourceDir: string, fileName: string) {
  const zipDir = await fs.mkdtemp(path.join(os.tmpdir(), "eah-zip-"));
  const zipPath = path.join(zipDir, fileName);
  execFileSync("zip", ["-qr", zipPath, "."], { cwd: sourceDir });
  return zipPath;
}

function cleanupDir(targetPath: string) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
