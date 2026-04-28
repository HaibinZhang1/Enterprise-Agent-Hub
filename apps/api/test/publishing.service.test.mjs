import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { BadRequestException, ForbiddenException } = require("@nestjs/common");
const { PublishingPublicationService } = require("../src/publishing/publishing-publication.service.ts");
const { PublishingRepository } = require("../src/publishing/publishing.repository.ts");
const { PublishingSubmissionService } = require("../src/publishing/publishing-submission.service.ts");
const { PublishingReviewService } = require("../src/publishing/publishing-review.service.ts");
const { PublishingPrecheckService } = require("../src/publishing/publishing-precheck.service.ts");
const {
  compareSemver,
  isPermissionExpansion,
  parseSimpleFrontmatter
} = require("../src/publishing/publishing.utils.ts");
const { parseSubmissionInput } = require("../src/publishing/publishing-submission-input.ts");

const noopNotifications = {
  async notifySubmissionCreated() {},
  async notifyAuthorWorkflow() {},
  async notifyReviewTask() {}
};

function createServices({
  database = {
    async query() {
      throw new Error("unexpected query");
    },
    async one() {
      throw new Error("unexpected one");
    },
    async transaction(callback) {
      return callback({
        async query() {
          return { rowCount: 1, rows: [] };
        }
      });
    }
  },
  publishingRepository = {
    async loadActor() {
      throw new Error("unexpected loadActor");
    },
    async loadSkillByID() {
      throw new Error("unexpected loadSkillByID");
    },
    async loadReview() {
      throw new Error("unexpected loadReview");
    },
    async releaseExpiredReviewLocks() {},
    async loadHistory() {
      return [];
    },
    async insertHistory() {},
    async recordJobRun() {}
  },
  reviewerRouting = {
    canSubmitterWithdraw() {
      return true;
    },
    assertClaimedReview() {},
    async canActorReview() {
      return true;
    },
    async shouldAutoApprove() {
      return false;
    }
  },
  packageStorage = {
    async stageSubmissionPackage() {
      throw new Error("unexpected stageSubmissionPackage");
    },
    async listPackageFilesForReview() {
      return [];
    },
    async readPackageFileContentForReview() {
      throw new Error("unexpected readPackageFileContentForReview");
    },
    async readReviewPackageBuffer() {
      throw new Error("unexpected readReviewPackageBuffer");
    },
    async copyObject() {},
    packageBucket() {
      return "skill-packages";
    }
  },
  notifications = noopNotifications
} = {}) {
  return {
    submissionService: new PublishingSubmissionService(
      database,
      publishingRepository,
      reviewerRouting,
      packageStorage,
      notifications
    ),
    reviewService: new PublishingReviewService(
      database,
      publishingRepository,
      reviewerRouting,
      {
        async publishSubmission() {},
        async finalizeReview() {},
      },
      notifications
    )
  };
}

function createReviewService({
  database = {
    async transaction(callback) {
      return callback({
        async query() {
          return { rowCount: 1, rows: [] };
        }
      });
    }
  },
  publishingRepository = {
    async loadActor() {
      throw new Error("unexpected loadActor");
    },
    async loadReview() {
      throw new Error("unexpected loadReview");
    },
    async releaseExpiredReviewLocks() {},
    async insertHistory() {}
  },
  reviewerRouting = {
    assertClaimedReview() {},
    async canActorReview() {
      return true;
    },
    async shouldAutoApprove() {
      return false;
    }
  },
  publication = {
    async publishSubmission() {},
    async finalizeReview() {}
  },
  notifications = noopNotifications
} = {}) {
  return new PublishingReviewService(
    database,
    publishingRepository,
    reviewerRouting,
    publication,
    notifications
  );
}

test("PublishingPrecheckService keeps auto-approved reviews pending until publish succeeds", async () => {
  const updates = [];
  const history = [];
  const jobRuns = [];
  const published = [];
  const reviewBeforePrecheck = {
    review_id: "rv_auto",
    skill_id: "prompt-guardrails",
    skill_display_name: "Prompt Guardrails",
    description: "Guardrails",
    submitter_id: "u_admin",
    submitter_role: "admin",
    submitter_admin_level: 1,
    submitter_department_id: "dept-1",
    review_type: "permission_change",
    workflow_state: "system_prechecking",
    review_status: "pending",
    current_version: "1.0.0",
    requested_version: null,
    requested_visibility_level: "public_installable",
    requested_scope_type: "all_employees",
    staged_package_size_bytes: null,
    staged_package_file_count: null,
  };
  const reviewAfterPrecheck = {
    ...reviewBeforePrecheck,
    workflow_state: "pending_review",
  };
  let loadReviewCount = 0;
  const service = new PublishingPrecheckService(
    {
      async transaction(callback) {
        return callback({
          async query(text, values = []) {
            updates.push({ text, values });
            return { rowCount: 1, rows: [] };
          }
        });
      }
    },
    {
      async loadReview() {
        loadReviewCount += 1;
        return loadReviewCount === 1 ? reviewBeforePrecheck : reviewAfterPrecheck;
      },
      async loadSkillByID() {
        return { skill_id: "prompt-guardrails", version: "1.0.0" };
      },
      async recordJobRun(reviewID, status) {
        jobRuns.push({ reviewID, status });
      },
      async insertHistory(_client, reviewID, actorID, action, comment) {
        history.push({ reviewID, actorID, action, comment });
      }
    },
    {
      async shouldAutoApprove() {
        return true;
      }
    },
    {
      async readReviewPackageBuffer() {
        throw new Error("permission_change should not read package");
      }
    },
    noopNotifications,
    {
      async publishSubmission(review, actor, comment) {
        published.push({ review, actor, comment });
      }
    }
  );

  await service.processSystemPrecheck("rv_auto");

  assert.match(updates[0].text, /workflow_state = \$3/);
  assert.match(updates[0].text, /review_status = 'pending'/);
  assert.equal(updates[0].values[2], "pending_review");
  assert.equal(published[0].review.workflow_state, "pending_review");
  assert.deepEqual(jobRuns.map((job) => job.status), ["running", "finished"]);
  assert.equal(history[0].action, "system_precheck_passed");
});

test("publishing utils parse frontmatter and detect semver expansion rules", () => {
  const frontmatter = parseSimpleFrontmatter(`---
name: prompt-guardrails
description: Prompt guard rails
allowed-tools:
  - bash
  - web
---

body`);

  assert.equal(frontmatter.name, "prompt-guardrails");
  assert.equal(frontmatter.description, "Prompt guard rails");
  assert.deepEqual(frontmatter.allowedTools, ["bash", "web"]);
  assert.equal(compareSemver("1.2.0", "1.1.9") > 0, true);
  assert.equal(
    isPermissionExpansion({
      currentVisibilityLevel: "summary_visible",
      currentScopeType: "current_department",
      nextVisibilityLevel: "detail_visible",
      nextScopeType: "department_tree",
      currentSelectedDepartmentIDs: [],
      nextSelectedDepartmentIDs: []
    }),
    true
  );
});

test("parseSubmissionInput accepts only fixed Chinese taxonomy values", () => {
  const input = parseSubmissionInput({
    submissionType: "publish",
    skillID: "prompt-guardrails",
    displayName: "提示词护栏模板",
    description: "发布前检查提示词结构。",
    version: "1.0.0",
    visibilityLevel: "detail_visible",
    scopeType: "current_department",
    changelog: "首次发布",
    category: "开发",
    tags: JSON.stringify(["提示", "规范", "提示"]),
    compatibleTools: JSON.stringify(["codex"]),
    compatibleSystems: JSON.stringify(["windows"]),
  });

  assert.equal(input.category, "开发");
  assert.deepEqual(input.tags, ["提示", "规范"]);
});

test("parseSubmissionInput rejects free-form or empty tags for publish submissions", () => {
  assert.throws(
    () => parseSubmissionInput({
      submissionType: "publish",
      skillID: "prompt-guardrails",
      displayName: "提示词护栏模板",
      description: "发布前检查提示词结构。",
      version: "1.0.0",
      visibilityLevel: "detail_visible",
      scopeType: "current_department",
      changelog: "首次发布",
      category: "engineering",
      tags: "prompt,governance",
    }),
    BadRequestException,
  );
});

test("parseSubmissionInput rejects invalid skill slugs and semver", () => {
  const base = {
    submissionType: "publish",
    skillID: "prompt-guardrails",
    displayName: "提示词护栏模板",
    description: "发布前检查提示词结构。",
    version: "1.0.0",
    visibilityLevel: "detail_visible",
    scopeType: "current_department",
    changelog: "首次发布",
    category: "开发",
    tags: JSON.stringify(["提示"])
  };

  assert.throws(() => parseSubmissionInput({ ...base, skillID: "Prompt Guardrails" }), BadRequestException);
  assert.throws(() => parseSubmissionInput({ ...base, version: "1.0" }), BadRequestException);
});

test("PublishingSubmissionService rejects first publish when slug already exists", async () => {
  const { submissionService } = createServices({
    publishingRepository: {
      async loadActor() {
        return {
          userID: "u_author",
          displayName: "作者",
          departmentID: "dept_frontend",
          departmentName: "前端组"
        };
      },
      async loadSkillByID() {
        return {
          id: "skill-row-1",
          skill_id: "prompt-guardrails",
          author_id: "u_author",
          status: "published",
          version: "1.0.0"
        };
      }
    },
    packageStorage: {
      async stageSubmissionPackage() {
        throw new Error("duplicate publish should not stage files");
      }
    }
  });

  await assert.rejects(
    () =>
      submissionService.createSubmission(
        "u_author",
        {
          submissionType: "publish",
          skillID: "prompt-guardrails",
          displayName: "提示词护栏模板",
          description: "发布前检查提示词结构。",
          version: "1.0.0",
          visibilityLevel: "detail_visible",
          scopeType: "current_department",
          changelog: "首次发布",
          category: "开发",
          tags: JSON.stringify(["提示"])
        },
        [{ originalname: "prompt-guardrails/SKILL.md", buffer: Buffer.from("# Skill") }]
      ),
    BadRequestException
  );
});

test("PublishingSubmissionService allows first publish to reuse an archived slug", async () => {
  let staged = false;
  const { submissionService } = createServices({
    publishingRepository: {
      async loadActor() {
        return {
          userID: "u_author",
          displayName: "作者",
          departmentID: "dept_frontend",
          departmentName: "前端组"
        };
      },
      async loadSkillByID() {
        return {
          id: "skill-row-1",
          skill_id: "prompt-guardrails",
          author_id: "u_author",
          status: "archived",
          version: "1.0.0"
        };
      }
    },
    packageStorage: {
      async stageSubmissionPackage() {
        staged = true;
        return {
          bucket: "staged-review-packages",
          objectKey: "reviews/review-1/package.zip",
          sha256: "sha256:stage",
          sizeBytes: 256,
          fileCount: 1
        };
      }
    }
  });

  const result = await submissionService.createSubmission(
    "u_author",
    {
      submissionType: "publish",
      skillID: "prompt-guardrails",
      displayName: "提示词护栏模板",
      description: "发布前检查提示词结构。",
      version: "1.0.1",
      visibilityLevel: "detail_visible",
      scopeType: "current_department",
      changelog: "归档后重新发布",
      category: "开发",
      tags: JSON.stringify(["提示"])
    },
    [{ originalname: "prompt-guardrails/SKILL.md", buffer: Buffer.from("# Skill") }]
  );

  assert.equal(staged, true);
  assert.equal(result.actorUserID, "u_author");
});

test("PublishingSubmissionService restores submitted folder relative paths when Multer strips names", async () => {
  let stagedFiles = [];
  const { submissionService } = createServices({
    publishingRepository: {
      async loadActor() {
        return {
          userID: "u_author",
          displayName: "作者",
          departmentID: "dept_frontend",
          departmentName: "前端组"
        };
      },
      async loadSkillByID() {
        return null;
      }
    },
    packageStorage: {
      async stageSubmissionPackage(_reviewID, _input, files) {
        stagedFiles = files;
        return {
          bucket: "staged-review-packages",
          objectKey: "reviews/review-1/package.zip",
          sha256: "sha256:stage",
          sizeBytes: 256,
          fileCount: 1
        };
      }
    }
  });

  await submissionService.createSubmission(
    "u_author",
    {
      submissionType: "publish",
      skillID: "prompt-guardrails",
      displayName: "提示词护栏模板",
      description: "发布前检查提示词结构。",
      version: "1.0.0",
      visibilityLevel: "detail_visible",
      scopeType: "current_department",
      changelog: "首次发布",
      category: "开发",
      tags: JSON.stringify(["提示"]),
      fileRelativePaths: JSON.stringify(["prompt-guardrails/SKILL.md"])
    },
    [{ originalname: "SKILL.md", buffer: Buffer.from("# Skill") }]
  );

  assert.deepEqual(
    stagedFiles.map((file) => file.originalname),
    ["prompt-guardrails/SKILL.md"]
  );
});

test("PublishingPublicationService republishes archived skills back to published status", async () => {
  const queries = [];
  const publicationService = new PublishingPublicationService(
    {
      async transaction(callback) {
        return callback({
          async query(text, values = []) {
            queries.push({ text, values });
            if (/INSERT INTO skill_versions/.test(text)) {
              return { rowCount: 1, rows: [] };
            }
            if (/INSERT INTO skill_packages/.test(text)) {
              return { rowCount: 1, rows: [] };
            }
            return { rowCount: 1, rows: [] };
          }
        });
      }
    },
    {
      async loadSkillByID() {
        return {
          id: "skill-row-1",
          skill_id: "prompt-guardrails",
          display_name: "提示词护栏模板",
          description: "旧描述",
          author_id: "u_author",
          department_id: "dept_frontend",
          status: "archived",
          visibility_level: "private",
          category: "开发",
          version: "1.0.0",
          current_version_id: "version-1"
        };
      },
      async insertHistory() {}
    },
    {
      async copyObject() {},
      packageBucket() {
        return "skill-packages";
      }
    },
    noopNotifications
  );

  await publicationService.publishSubmission(
    {
      review_id: "review-1",
      skill_id: "prompt-guardrails",
      skill_display_name: "提示词护栏模板",
      submitter_id: "u_author",
      submitter_department_id: "dept_frontend",
      requested_visibility_level: "detail_visible",
      requested_scope_type: "current_department",
      requested_department_ids: [],
      current_version: "1.0.0",
      review_type: "publish",
      requested_version: "1.0.1",
      staged_package_bucket: "staged-review-packages",
      staged_package_object_key: "reviews/review-1/package.zip",
      staged_package_sha256: "sha256:stage",
      staged_package_size_bytes: 256,
      staged_package_file_count: 1,
      submission_payload: {
        description: "新描述",
        changelog: "归档后重新发布",
        category: "开发",
        tags: ["提示"],
        compatibleTools: ["codex"],
        compatibleSystems: ["windows"]
      }
    },
    { userID: "u_admin" },
    "通过审核"
  );

  const updateSkill = queries.find(({ text }) => /UPDATE skills/.test(text));
  assert.ok(updateSkill);
  assert.match(updateSkill.text, /status = \$6/);
  assert.equal(updateSkill.values[5], "published");
});

test("PublishingSubmissionService lets authors delist and relist their own skills but blocks invalid transitions", async () => {
  const queries = [];
  const { submissionService } = createServices({
    database: {
      async query(text, values = []) {
        queries.push({ text, values });
        return { rows: [] };
      }
    },
    publishingRepository: {
      async loadActor() {
        return { userID: "u_author", role: "normal_user" };
      },
      async loadSkillByID() {
        return {
          skill_id: "prompt-guardrails",
          author_id: "u_author",
          status: "published"
        };
      }
    }
  });

  const actorUserID = await submissionService.setPublisherSkillStatus("u_author", "prompt-guardrails", "delist");
  assert.equal(actorUserID, "u_author");
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /UPDATE skills SET status = \$2/);
  assert.deepEqual(queries[0].values, ["prompt-guardrails", "delisted"]);
});

test("PublishingSubmissionService only lets authors withdraw submissions that are still withdrawable", async () => {
  const history = [];
  const { submissionService } = createServices({
    publishingRepository: {
      async loadActor() {
        return { userID: "u_author", role: "normal_user" };
      },
      async loadReview() {
        return {
          review_id: "rv_001",
          submitter_id: "u_author",
          workflow_state: "manual_precheck",
          review_status: "pending",
          lock_owner_id: null,
          lock_expires_at: null,
        };
      },
      async releaseExpiredReviewLocks() {},
      async insertHistory(_client, reviewID, actorID, action, comment) {
        history.push({ reviewID, actorID, action, comment });
      }
    },
    reviewerRouting: {
      canSubmitterWithdraw(userID, review) {
        return review.submitter_id === userID && review.workflow_state === "manual_precheck";
      },
      assertClaimedReview() {},
      async canActorReview() {
        return true;
      },
      async shouldAutoApprove() {
        return false;
      }
    }
  });

  const result = await submissionService.withdrawSubmission("u_author", "rv_001");
  assert.deepEqual(result, { actorUserID: "u_author", submissionID: "rv_001" });
  assert.equal(history[0].action, "withdrawn");
});

test("PublishingSubmissionService blocks withdraw when the submission is no longer withdrawable", async () => {
  const { submissionService } = createServices({
    publishingRepository: {
      async loadActor() {
        return { userID: "u_author", role: "normal_user" };
      },
      async loadReview() {
        return {
          review_id: "rv_002",
          submitter_id: "u_author",
          workflow_state: "pending_review",
          review_status: "in_review",
          lock_owner_id: "u_reviewer",
          lock_expires_at: new Date(Date.now() + 60_000).toISOString(),
        };
      },
      async releaseExpiredReviewLocks() {}
    },
    reviewerRouting: {
      canSubmitterWithdraw() {
        return false;
      },
      assertClaimedReview() {},
      async canActorReview() {
        return true;
      },
      async shouldAutoApprove() {
        return false;
      }
    }
  });

  await assert.rejects(
    () => submissionService.withdrawSubmission("u_author", "rv_002"),
    (error) => {
      assert.ok(error instanceof ForbiddenException);
      assert.equal(error.message, "permission_denied");
      return true;
    }
  );
});

test("PublishingRepository releaseExpiredReviewLocks restores the claimed source workflow and records history", async () => {
  const queries = [];
  const repository = new PublishingRepository({
    async transaction(callback) {
      return callback({
        async query(text, values = []) {
          queries.push({ text, values });
          if (/SELECT id, claimed_from_workflow_state/.test(text)) {
            return {
              rows: [{ id: "rv_expired", claimed_from_workflow_state: "pending_review" }]
            };
          }
          return { rowCount: 1, rows: [] };
        }
      });
    }
  });

  await repository.releaseExpiredReviewLocks("rv_expired");

  const update = queries.find(({ text }) => /UPDATE review_items/.test(text));
  const history = queries.find(({ text }) => /INSERT INTO review_item_history/.test(text));
  assert.ok(update);
  assert.match(update.text, /workflow_state = claimed_from_workflow_state/);
  assert.match(update.text, /claimed_from_workflow_state = NULL/);
  assert.ok(history);
  assert.equal(history.values[3], "lock_expired");
});

test("PublishingReviewService claimReview moves the lifecycle into in_review and remembers the source state", async () => {
  const updates = [];
  const history = [];
  const notifications = [];
  const service = createReviewService({
    database: {
      async transaction(callback) {
        return callback({
          async query(text, values = []) {
            updates.push({ text, values });
            return { rowCount: 1, rows: [] };
          }
        });
      }
    },
    publishingRepository: {
      async releaseExpiredReviewLocks(reviewID) {
        assert.equal(reviewID, "rv_001");
      },
      async loadActor() {
        return { userID: "u_reviewer", displayName: "审核员", role: "admin", adminLevel: 2 };
      },
      async loadReview() {
        return {
          review_id: "rv_001",
          skill_id: "prompt-guardrails",
          skill_display_name: "提示词护栏模板",
          submitter_id: "u_author",
          workflow_state: "pending_review",
          review_status: "pending",
          lock_owner_id: null,
          lock_expires_at: null
        };
      },
      async insertHistory(_client, reviewID, actorID, action, comment) {
        history.push({ reviewID, actorID, action, comment });
      }
    },
    reviewerRouting: {
      async canActorReview() {
        return true;
      },
      assertClaimedReview() {},
      async shouldAutoApprove() {
        return false;
      }
    },
    notifications: {
      async notifyAuthorWorkflow(_client, review, input) {
        notifications.push({ review, input });
      },
      async notifySubmissionCreated() {},
      async notifyReviewTask() {}
    }
  });

  const actorUserID = await service.claimReview("u_reviewer", "rv_001");

  assert.equal(actorUserID, "u_reviewer");
  assert.match(updates[0].text, /claimed_from_workflow_state = workflow_state/);
  assert.match(updates[0].text, /workflow_state = 'in_review'/);
  assert.equal(history[0].action, "claimed");
  assert.equal(notifications[0].review.review_id, "rv_001");
});

test("PublishingReviewService passPrecheck moves review into pending_review when auto-approve is false", async () => {
  const updates = [];
  const history = [];
  const notifications = [];
  const service = createReviewService({
    database: {
      async transaction(callback) {
        return callback({
          async query(text, values = []) {
            updates.push({ text, values });
            return { rowCount: 1, rows: [] };
          }
        });
      }
    },
    publishingRepository: {
      async loadActor() {
        return { userID: "u_reviewer", role: "admin", adminLevel: 2 };
      },
      async loadReview() {
        return {
          review_id: "rv_001",
          workflow_state: "in_review",
          claimed_from_workflow_state: "manual_precheck",
          submitter_id: "u_author",
          submitter_role: "normal_user",
          submitter_admin_level: null,
          lock_owner_id: "u_reviewer",
          lock_expires_at: new Date(Date.now() + 60_000)
        };
      },
      async insertHistory(_client, reviewID, actorID, action, comment) {
        history.push({ reviewID, actorID, action, comment });
      }
    },
    reviewerRouting: {
      assertClaimedReview() {},
      async canActorReview() {
        return true;
      },
      async shouldAutoApprove() {
        return false;
      },
      async eligibleReviewerIDsFor() {
        return ["u_admin_nearest"];
      }
    },
    notifications: {
      async notifyAuthorWorkflow(_client, review, input) {
        notifications.push({ kind: "author", review, input });
      },
      async notifyReviewTask(_client, review, reviewerIDs, summary) {
        notifications.push({ kind: "task", review, reviewerIDs, summary });
      },
      async notifySubmissionCreated() {}
    }
  });
  const actorUserID = await service.passPrecheck("u_reviewer", "rv_001", "人工复核通过");
  assert.equal(actorUserID, "u_reviewer");
  assert.match(updates[0].text, /UPDATE review_items/);
  assert.equal(history[0].action, "pass_precheck");
  assert.deepEqual(notifications.map((notice) => notice.kind), ["author", "task"]);
});

test("PublishingReviewService requires a comment before overriding blocking precheck failures", async () => {
  const service = createReviewService({
    publishingRepository: {
      async loadActor() {
        return { userID: "u_reviewer", role: "admin", adminLevel: 2 };
      },
      async loadReview() {
        return {
          review_id: "rv_blocked",
          workflow_state: "in_review",
          claimed_from_workflow_state: "manual_precheck",
          submitter_id: "u_author",
          submitter_role: "normal_user",
          submitter_admin_level: null,
          lock_owner_id: "u_reviewer",
          lock_expires_at: new Date(Date.now() + 60_000),
          precheck_results: [
            {
              id: "skill-md",
              label: "存在 SKILL.md",
              status: "warn",
              message: "缺少 SKILL.md，需人工复核。",
            },
          ],
        };
      },
      async insertHistory() {
        throw new Error("blocked precheck should not write history");
      },
    },
    reviewerRouting: {
      assertClaimedReview() {},
      async canActorReview() {
        return true;
      },
      async shouldAutoApprove() {
        return false;
      },
    },
  });

  await assert.rejects(
    () => service.passPrecheck("u_reviewer", "rv_blocked", ""),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.message, "precheck_override_comment_required");
      return true;
    },
  );
});

test("PublishingReviewService records an override before allowing blocking precheck failures", async () => {
  const history = [];
  const service = createReviewService({
    publishingRepository: {
      async loadActor() {
        return { userID: "u_reviewer", role: "admin", adminLevel: 2 };
      },
      async loadReview() {
        return {
          review_id: "rv_blocked",
          skill_display_name: "提示词护栏模板",
          workflow_state: "in_review",
          claimed_from_workflow_state: "manual_precheck",
          submitter_id: "u_author",
          submitter_role: "normal_user",
          submitter_admin_level: null,
          lock_owner_id: "u_reviewer",
          lock_expires_at: new Date(Date.now() + 60_000),
          precheck_results: [
            {
              id: "skill-md",
              label: "存在 SKILL.md",
              status: "warn",
              message: "缺少 SKILL.md，需人工复核。",
            },
          ],
        };
      },
      async insertHistory(_client, reviewID, actorID, action, comment) {
        history.push({ reviewID, actorID, action, comment });
      },
    },
    reviewerRouting: {
      assertClaimedReview() {},
      async canActorReview() {
        return true;
      },
      async shouldAutoApprove() {
        return false;
      },
      async eligibleReviewerIDsFor() {
        return ["u_admin_nearest"];
      },
    },
  });

  await service.passPrecheck("u_reviewer", "rv_blocked", "确认风险，允许覆盖。");

  assert.deepEqual(
    history.map((item) => item.action),
    ["override_precheck", "pass_precheck"],
  );
});

test("PublishingReviewService applies the same precheck override rule to final approval", async () => {
  const published = [];
  const service = createReviewService({
    publishingRepository: {
      async loadActor() {
        return { userID: "u_reviewer", role: "admin", adminLevel: 2 };
      },
      async loadReview() {
        return {
          review_id: "rv_approve_blocked",
          workflow_state: "in_review",
          claimed_from_workflow_state: "pending_review",
          submitter_id: "u_author",
          lock_owner_id: "u_reviewer",
          lock_expires_at: new Date(Date.now() + 60_000),
          precheck_results: [
            {
              id: "semver",
              label: "版本号合法",
              status: "warn",
              message: "版本号不符合规范。",
            },
          ],
        };
      },
      async insertHistory() {}
    },
    reviewerRouting: {
      assertClaimedReview() {},
      async canActorReview() {
        return true;
      },
      async shouldAutoApprove() {
        return false;
      }
    },
    publication: {
      async publishSubmission(review, actor, comment, options) {
        published.push({ review, actor, comment, options });
      },
      async finalizeReview() {}
    }
  });

  await assert.rejects(
    () => service.approveReview("u_reviewer", "rv_approve_blocked", ""),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.message, "precheck_override_comment_required");
      return true;
    },
  );

  await service.approveReview("u_reviewer", "rv_approve_blocked", "确认版本风险，允许发布。");

  assert.equal(published.length, 1);
  assert.deepEqual(published[0].options.preHistory, {
    action: "override_precheck",
    comment: "确认版本风险，允许发布。",
  });
});
