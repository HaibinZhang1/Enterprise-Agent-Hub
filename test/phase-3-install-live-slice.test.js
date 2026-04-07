import assert from 'node:assert/strict';
import test from 'node:test';

import { createLiveInstallSlice } from '../apps/api/src/modules/install/live-install-slice.js';
import { createInstallDesktopRuntime } from '../apps/desktop/src/runtime/install-desktop-runtime.js';

test('phase 3 install/desktop slice executes request -> sync -> activate/deactivate -> recoverable failure flows', () => {
  const api = createLiveInstallSlice();
  const desktop = createInstallDesktopRuntime({ installController: api.installController });
  const actor = {
    userId: 'user-1',
    username: 'wangwu',
    roleCode: 'employee_lv6',
    departmentId: 'dept-2',
  };

  desktop.seedOccupiedTarget({ type: 'tool', id: 'claude-cli' });

  const install = api.installController.requestInstall({
    requestId: 'req-install-1',
    actor,
    skillId: 'skill-sync-assistant',
    version: '1.0.0',
    target: { type: 'tool', id: 'claude-cli' },
    now: new Date('2026-04-07T01:00:00.000Z'),
  });
  assert.equal(install.status, 'requested');

  const conflictSync = desktop.syncInstall({
    requestId: 'req-install-1-sync',
    actor,
    installId: install.installId,
    online: true,
    now: new Date('2026-04-07T01:00:10.000Z'),
  });
  assert.equal(conflictSync.ok, false);
  assert.equal(conflictSync.failureReason, 'target_conflict');
  assert.equal(conflictSync.localInstall.reconcileState, 'repair_required');
  assert.equal(conflictSync.serverInstall.status, 'requested');

  const resolution = desktop.resolveConflict({
    installId: install.installId,
    target: install.target,
    decision: 'overwrite',
    now: new Date('2026-04-07T01:00:20.000Z'),
  });
  assert.equal(resolution.decision, 'overwrite');

  const recoveredSync = desktop.recoverInstall({
    requestId: 'req-install-1-recover',
    actor,
    installId: install.installId,
    online: true,
    now: new Date('2026-04-07T01:00:30.000Z'),
  });
  assert.equal(recoveredSync.ok, true);
  assert.equal(recoveredSync.serverInstall.status, 'installed');
  assert.equal(recoveredSync.localInstall.localState, 'applied');
  assert.equal(recoveredSync.localInstall.reconcileState, 'in_sync');

  const activated = desktop.activateInstall({
    requestId: 'req-install-1-activate',
    actor,
    installId: install.installId,
    online: true,
    now: new Date('2026-04-07T01:00:40.000Z'),
  });
  assert.equal(activated.ok, true);
  assert.equal(activated.serverInstall.status, 'active');
  assert.equal(activated.localInstall.activationState, 'active');
  assert.equal(activated.localInstall.reconcileState, 'in_sync');

  const deactivated = desktop.deactivateInstall({
    requestId: 'req-install-1-deactivate',
    actor,
    installId: install.installId,
    online: true,
    now: new Date('2026-04-07T01:00:50.000Z'),
  });
  assert.equal(deactivated.ok, true);
  assert.equal(deactivated.serverInstall.status, 'inactive');
  assert.equal(deactivated.localInstall.activationState, 'inactive');
  assert.equal(deactivated.localInstall.reconcileState, 'in_sync');

  const offlineInstall = api.installController.requestInstall({
    requestId: 'req-install-2',
    actor,
    skillId: 'offline-recovery-skill',
    version: '2.0.0',
    target: { type: 'project', id: 'proj-1' },
    now: new Date('2026-04-07T01:01:00.000Z'),
  });
  const offlineSync = desktop.syncInstall({
    requestId: 'req-install-2-sync',
    actor,
    installId: offlineInstall.installId,
    online: false,
    now: new Date('2026-04-07T01:01:10.000Z'),
  });
  assert.equal(offlineSync.ok, false);
  assert.equal(offlineSync.failureReason, 'offline_blocked');
  assert.equal(offlineSync.serverInstall.status, 'requested');
  assert.equal(offlineSync.localInstall.reconcileState, 'offline_blocked');

  const offlineRecovery = desktop.recoverInstall({
    requestId: 'req-install-2-recover',
    actor,
    installId: offlineInstall.installId,
    online: true,
    now: new Date('2026-04-07T01:01:20.000Z'),
  });
  assert.equal(offlineRecovery.ok, true);
  assert.equal(offlineRecovery.serverInstall.status, 'installed');
  assert.equal(offlineRecovery.localInstall.localState, 'applied');
  assert.equal(offlineRecovery.localInstall.reconcileState, 'in_sync');

  assert.deepEqual(
    api.listInstalls(actor.userId).map((entry) => ({
      installId: entry.installId,
      status: entry.status,
      reconcileState: entry.lastDesktopReconcileState,
    })),
    [
      {
        installId: install.installId,
        status: 'inactive',
        reconcileState: 'in_sync',
      },
      {
        installId: offlineInstall.installId,
        status: 'installed',
        reconcileState: 'in_sync',
      },
    ],
  );

  assert.equal(api.listNotifications(actor.userId).length >= 4, true);
  assert.equal(api.getBadges(actor.userId).unreadCount >= 4, true);
  assert.deepEqual(
    api.getAuditTrail().map((entry) => entry.action),
    [
      'install.requested',
      'install.desktop_blocked',
      'install.desktop_synced',
      'install.activated',
      'install.desktop_synced',
      'install.deactivated',
      'install.desktop_synced',
      'install.requested',
      'install.desktop_blocked',
      'install.desktop_synced',
    ],
  );
  assert.equal(desktop.listConflictResolutions(install.installId).length, 1);
  assert.equal(desktop.listSyncJobs(offlineInstall.installId).some((job) => job.failureReason === 'offline_blocked'), true);
});
