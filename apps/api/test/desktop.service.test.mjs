import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('ts-node/register/transpile-only');

const { DesktopService } = require('../src/desktop/desktop.service.ts');

function desktopServiceForDatabase(database) {
  return new DesktopService(database, {});
}

function localEvent(overrides = {}) {
  return {
    eventID: 'evt-1',
    eventType: 'enable_result',
    skillID: 'codex-review-helper',
    version: '1.2.0',
    targetType: 'tool',
    targetID: 'codex',
    targetPath: '/Users/example/.codex/skills',
    requestedMode: 'copy',
    resolvedMode: 'copy',
    fallbackReason: null,
    result: 'success',
    occurredAt: '2026-04-24T00:00:00.000Z',
    ...overrides,
  };
}

test('DesktopService rejects malformed local event timestamps before database insert', async () => {
  const queries = [];
  const service = desktopServiceForDatabase({
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [] };
    },
  });

  const result = await service.acceptLocalEvents('user-1', {
    deviceID: 'desktop-1',
    events: [localEvent({ eventID: 'evt-bad-time', occurredAt: 'p1-local-1776611970174' })],
  });

  assert.deepEqual(result.acceptedEventIDs, []);
  assert.deepEqual(result.rejectedEvents, [
    {
      eventID: 'evt-bad-time',
      code: 'invalid_event',
      message: 'occurredAt must be an ISO date-time string',
    },
  ]);
  assert.equal(result.serverStateChanged, false);
  assert.equal(queries.length, 0);
});

test('DesktopService inserts valid ISO local event timestamps', async () => {
  const queries = [];
  const service = desktopServiceForDatabase({
    async query(text, values) {
      queries.push({ text, values });
      return { rows: [] };
    },
  });

  const result = await service.acceptLocalEvents('user-1', {
    deviceID: 'desktop-1',
    events: [localEvent()],
  });

  assert.deepEqual(result.acceptedEventIDs, ['evt-1']);
  assert.deepEqual(result.rejectedEvents, []);
  assert.equal(result.serverStateChanged, true);
  assert.equal(queries.length, 2);
  assert.match(queries[0].text, /INSERT INTO desktop_devices/);
  assert.match(queries[1].text, /INSERT INTO desktop_local_events/);
  assert.equal(queries[1].values[12], '2026-04-24T00:00:00.000Z');
});
