#!/usr/bin/env node
import assert from "node:assert/strict";
import process from "node:process";

const baseURL = normalizeBaseURL(process.env.P1_LIVE_BASE_URL ?? "http://127.0.0.1:3000");
const requireHealthOk = process.env.P1_REQUIRE_HEALTH_OK !== "false";
const normalCredentials = {
  username: process.env.P1_LIVE_USERNAME ?? "demo",
  password: process.env.P1_LIVE_PASSWORD ?? "demo123"
};
const adminCredentials = {
  username: process.env.P1_LIVE_ADMIN_USERNAME ?? "superadmin",
  password: process.env.P1_LIVE_ADMIN_PASSWORD ?? "demo123"
};

async function main() {
  const health = await requestJSON("/health");
  assert.equal(health.api, "ok", "health.api must be ok");
  if (requireHealthOk) {
    assert.equal(health.status, "ok", "health.status must be ok");
  }

  const userSession = await login(normalCredentials);
  assert.equal(userSession.tokenType, "Bearer", "user tokenType must be Bearer");
  assert.ok(userSession.accessToken.length > 0, "user accessToken missing");
  assert.ok(userSession.menuPermissions.includes("market"), "user missing market permission");

  const userHeaders = authHeaders(userSession.accessToken);
  const bootstrap = await requestJSON("/desktop/bootstrap", { headers: userHeaders });
  assert.equal(bootstrap.user.userID, userSession.user.userID, "bootstrap user mismatch");
  assert.ok(Array.isArray(bootstrap.navigation), "bootstrap navigation missing");
  assert.ok(bootstrap.navigation.includes("market"), "bootstrap missing market");
  assert.ok(!bootstrap.navigation.includes("manage"), "normal user should not have manage navigation");
  assert.ok(!bootstrap.navigation.includes("review"), "normal user should not have review navigation");
  assert.equal(bootstrap.features.publishSkill, true, "normal user should have publishSkill enabled");

  const skills = await requestJSON("/skills", { headers: userHeaders });
  assert.ok(Array.isArray(skills.items), "skills.items missing");
  assert.ok(skills.items.length > 0, "skills list should not be empty");

  const notifications = await requestJSON("/notifications", { headers: userHeaders });
  assert.ok(Array.isArray(notifications.items), "notifications.items missing");
  const publisherSkills = await requestJSON("/publisher/skills", { headers: userHeaders });
  assert.ok(Array.isArray(publisherSkills), "publisher skills payload must be an array");

  const adminSession = await login(adminCredentials);
  const adminHeaders = authHeaders(adminSession.accessToken);
  const adminBootstrap = await requestJSON("/desktop/bootstrap", { headers: adminHeaders });
  assert.ok(adminBootstrap.navigation.includes("manage"), "admin missing manage navigation");
  assert.ok(adminBootstrap.navigation.includes("review"), "admin missing review navigation");

  const adminUsers = await requestJSON("/admin/users", { headers: adminHeaders });
  assert.ok(Array.isArray(adminUsers), "admin users payload must be an array");
  assert.ok(adminUsers.length > 0, "admin users should not be empty");
  const adminReviews = await requestJSON("/admin/reviews", { headers: adminHeaders });
  assert.ok(Array.isArray(adminReviews), "admin reviews payload must be an array");

  console.log(`P1 live smoke PASS (${baseURL})`);
  console.log(`- health: ${health.status}`);
  console.log(`- normal user: ${normalCredentials.username}`);
  console.log(`- admin user: ${adminCredentials.username}`);
  console.log(`- skills: ${skills.items.length}`);
  console.log(`- notifications: ${notifications.items.length}`);
  console.log(`- publisher skills: ${publisherSkills.length}`);
  console.log(`- admin users: ${adminUsers.length}`);
  console.log(`- admin reviews: ${adminReviews.length}`);
}

async function login(credentials) {
  return requestJSON("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(credentials)
  });
}

function authHeaders(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`
  };
}

async function requestJSON(path, init = {}) {
  const response = await fetch(`${baseURL}${path}`, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`${path} failed: ${message}`);
  }
  return body;
}

function normalizeBaseURL(value) {
  return value.replace(/\/+$/, "");
}

main().catch((error) => {
  console.error("P1 live smoke FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
