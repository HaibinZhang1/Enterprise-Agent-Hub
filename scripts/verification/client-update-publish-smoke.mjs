#!/usr/bin/env node
import process from 'node:process';

const baseURL = normalizeBaseURL(process.env.P1_LIVE_BASE_URL ?? 'http://127.0.0.1:3000');
const adminPhone = process.env.P1_LIVE_ADMIN_PHONE_NUMBER ?? '13800000002';
const password = process.env.EAH_ADMIN_PASSWORD ?? process.env.P1_LIVE_ADMIN_PASSWORD ?? 'EAgentHub123!';

async function main() {
  const session = await requestJSON('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phoneNumber: adminPhone, password }),
  });
  const token = session.accessToken;
  const release = await requestJSON('/admin/client-updates/releases', {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({
      version: process.env.CLIENT_UPDATE_TEST_VERSION ?? '9.9.9',
      buildNumber: process.env.CLIENT_UPDATE_TEST_BUILD_NUMBER ?? 'smoke-build',
      platform: 'windows',
      arch: 'x64',
      channel: 'stable',
      mandatory: false,
      rolloutPercent: 100,
      releaseNotes: 'client update smoke release',
    }),
  });
  console.log('client-update publish smoke PASS');
  console.log(JSON.stringify({ releaseID: release.releaseID }, null, 2));
}

function authHeaders(accessToken, json = false) {
  return {
    authorization: `Bearer ${accessToken}`,
    ...(json ? { 'content-type': 'application/json' } : {}),
  };
}

async function requestJSON(path, init = {}) {
  const response = await fetch(`${baseURL}${path}`, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `${response.status} ${response.statusText}`);
  }
  return payload;
}

function normalizeBaseURL(value) {
  return value.replace(/\/+$/, '');
}

main().catch((error) => {
  console.error('client-update publish smoke FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
