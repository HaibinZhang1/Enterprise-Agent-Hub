import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require("ts-node/register/transpile-only");

const { ReviewerRoutingService } = require("../src/publishing/reviewer-routing.service.ts");

function createService(database) {
  return new ReviewerRoutingService(database);
}

test("ReviewerRoutingService routes normal-user submissions to direct department admins", async () => {
  const service = createService({
    async query(text, values = []) {
      if (/FROM users\s+WHERE role = 'admin'[\s\S]*department_id = \$1/.test(text)) {
        assert.deepEqual(values, ["dept_frontend"]);
        return { rows: [{ id: "u_admin_front_1" }, { id: "u_admin_front_2" }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const reviewerIDs = await service.eligibleReviewerIDsFor({
    workflow_state: "pending_review",
    review_type: "publish",
    requested_visibility_level: "summary_visible",
    requested_scope_type: "current_department",
    current_scope_type: null,
    current_visibility_level: null,
    current_scope_department_ids: [],
    requested_department_ids: [],
    submitter_role: "normal_user",
    submitter_admin_level: null,
    submitter_department_id: "dept_frontend",
    submitter_id: "u_author_frontend"
  });
  assert.deepEqual(reviewerIDs, ["u_admin_front_1", "u_admin_front_2"]);
});

test("ReviewerRoutingService routes level-4 private submissions to peer admins before escalation", async () => {
  const service = createService({
    async query(text, values = []) {
      if (/FROM users u[\s\S]*u\.admin_level = \$1/.test(text) && /d\.parent_id IS NOT DISTINCT FROM \$3/.test(text)) {
        assert.deepEqual(values, [4, "u_admin_l4_a", "dept_backend"]);
        return { rows: [{ id: "u_admin_l4_b" }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const reviewerIDs = await service.eligibleReviewerIDsFor({
    workflow_state: "pending_review",
    review_type: "publish",
    requested_visibility_level: "summary_visible",
    requested_scope_type: "current_department",
    current_scope_type: null,
    current_visibility_level: null,
    current_scope_department_ids: [],
    requested_department_ids: [],
    submitter_role: "admin",
    submitter_admin_level: 4,
    submitter_department_id: "dept_java_a",
    submitter_parent_department_id: "dept_backend",
    submitter_id: "u_admin_l4_a"
  });
  assert.deepEqual(reviewerIDs, ["u_admin_l4_b"]);
});

test("ReviewerRoutingService routes public submissions to nearest level-3 reviewer on the org chain", async () => {
  const service = createService({
    async query(text, values = []) {
      if (/WITH RECURSIVE ancestry/.test(text)) {
        return {
          rows: [
            { department_id: "dept_java_a", parent_id: "dept_backend", path: "/集团/技术部/后端组/JavaA", level: 3 },
            { department_id: "dept_backend", parent_id: "dept_engineering", path: "/集团/技术部/后端组", level: 2 },
            { department_id: "dept_engineering", parent_id: "dept_company", path: "/集团/技术部", level: 1 },
            { department_id: "dept_company", parent_id: null, path: "/集团", level: 0 }
          ]
        };
      }
      if (/u\.admin_level = \$1/.test(text) && /u\.department_id = ANY/.test(text)) {
        assert.equal(values[0], 3);
        return { rows: [{ id: "u_admin_l3_backend", department_id: "dept_backend" }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  });

  const reviewerIDs = await service.eligibleReviewerIDsFor({
    workflow_state: "pending_review",
    review_type: "publish",
    requested_visibility_level: "public_installable",
    requested_scope_type: "all_employees",
    current_scope_type: null,
    current_visibility_level: null,
    current_scope_department_ids: [],
    requested_department_ids: [],
    submitter_role: "admin",
    submitter_admin_level: 4,
    submitter_department_id: "dept_java_a",
    submitter_parent_department_id: "dept_backend",
    submitter_id: "u_admin_l4_a"
  });
  assert.deepEqual(reviewerIDs, ["u_admin_l3_backend"]);
});
