import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sharedContracts = readFileSync(new URL('../../../packages/shared-contracts/src/index.ts', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../src/client-updates/client-updates.controller.ts', import.meta.url), 'utf8');
const adminController = readFileSync(new URL('../src/client-updates/client-updates-admin.controller.ts', import.meta.url), 'utf8');

test('client update API routes are centralized in shared contracts and implemented by controllers', () => {
  assert.match(sharedContracts, /clientUpdatesCheck: "\/client-updates\/check"/);
  assert.match(sharedContracts, /clientUpdateDownloadTicket: "\/client-updates\/releases\/:releaseID\/download-ticket"/);
  assert.match(sharedContracts, /adminClientUpdateReleases: "\/admin\/client-updates\/releases"/);
  assert.match(sharedContracts, /adminClientUpdatePublish: "\/admin\/client-updates\/releases\/:releaseID\/publish"/);

  assert.match(controller, /@Controller\('client-updates'\)/);
  assert.doesNotMatch(controller, /@Controller\('client-updates'\)\s*@UseGuards\(P1AuthGuard\)\s*export class/s);
  assert.match(controller, /@UseGuards\(P1AuthGuard\)\s*@Post\('check'\)/);
  assert.match(controller, /@Post\('check'\)/);
  assert.match(controller, /@Post\('releases\/:releaseID\/download-ticket'\)/);
  assert.match(controller, /@Get\('releases\/:releaseID\/download'\)/);
  assert.match(adminController, /@Controller\('admin\/client-updates'\)/);
  assert.match(adminController, /@Post\('releases'\)/);
  assert.match(adminController, /@Post\('releases\/:releaseID\/publish'\)/);
});
