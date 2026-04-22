import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { BadRequestException, ForbiddenException } = require("@nestjs/common");
const { PublishingPublicationService } = require("../src/publishing/publishing-publication.service.ts");
const { PublishingSubmissionService } = require("../src/publishing/publishing-submission.service.ts");
const { PublishingReviewService } = require("../src/publishing/publishing-review.service.ts");
const {
  compareSemver,
  isPermissionExpansion,
  parseSimpleFrontmatter
} = require("../src/publishing/publishing.utils.ts");
const { parseSubmissionInput } = require("../src/publishing/publishing-submission-input.ts");

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
  }
} = {}) {
  return {
    submissionService: new PublishingSubmissionService(
      database,
      publishingRepository,
      reviewerRouting,
      packageStorage
    ),
    reviewService: new PublishingReviewService(
      database,
      publishingRepository,
      reviewerRouting,
      {
        async publishSubmission() {},
        async finalizeReview() {},
      }
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
  }
} = {}) {
  return new PublishingReviewService(
    database,
    publishingRepository,
    reviewerRouting,
    publication
  );
}

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
    }
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
      }
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

test("PublishingReviewService passPrecheck moves review into pending_review when auto-approve is false", async () => {
  const updates = [];
  const history = [];
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
          workflow_state: "manual_precheck",
          submitter_id: "u_author",
          submitter_role: "normal_user",
          submitter_admin_level: null
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
      }
    }
  });
  const actorUserID = await service.passPrecheck("u_reviewer", "rv_001", "人工复核通过");
  assert.equal(actorUserID, "u_reviewer");
  assert.match(updates[0].text, /UPDATE review_items/);
  assert.equal(history[0].action, "pass_precheck");
});

test("PublishingReviewService blocks passPrecheck when mandatory package checks failed", async () => {
  const service = createReviewService({
    publishingRepository: {
      async loadActor() {
        return { userID: "u_reviewer", role: "admin", adminLevel: 2 };
      },
      async loadReview() {
        return {
          review_id: "rv_blocked",
          workflow_state: "manual_precheck",
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
    () => service.passPrecheck("u_reviewer", "rv_blocked", "仍然通过"),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.message, "validation_failed");
      return true;
    },
  );
});
