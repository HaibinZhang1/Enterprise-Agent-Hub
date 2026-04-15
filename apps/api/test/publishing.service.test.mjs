import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { ForbiddenException } = require("@nestjs/common");
const { PublishingSubmissionService } = require("../src/publishing/publishing-submission.service.ts");
const { PublishingReviewService } = require("../src/publishing/publishing-review.service.ts");
const {
  compareSemver,
  isPermissionExpansion,
  parseSimpleFrontmatter
} = require("../src/publishing/publishing.utils.ts");

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
