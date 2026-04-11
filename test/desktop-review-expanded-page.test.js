import assert from 'node:assert/strict';
import test from 'node:test';

import { createDesktopShellState } from '../apps/desktop/ui/core/store.js';
import { createReviewPage } from '../apps/desktop/ui/pages/review.js';

function createState(overrides = {}) {
  return {
    ...createDesktopShellState(),
    ...overrides,
    remote: {
      ...createDesktopShellState().remote,
      ...(overrides.remote ?? {}),
    },
  };
}

async function renderPage(state) {
  const host = { innerHTML: '' };
  const page = createReviewPage({
    store: {
      getState() {
        return state;
      },
    },
  });
  page.mount(host);
  await page.enter({ state, reason: 'test-render' });
  return host.innerHTML;
}

test('review page renders queue, detail, timeline, and expanded actions', async () => {
  const markup = await renderPage(
    createState({
      session: {
        user: {
          userId: 'reviewer-1',
        },
      },
      remote: {
        review: {
          status: 'loaded',
          message: 'ok',
          queue: {
            todo: [{ ticketId: 'review-1', skillId: 'skill-alpha', status: 'todo' }],
            inProgress: [{ ticketId: 'review-2', skillId: 'skill-beta', status: 'in_progress' }],
            done: [{ ticketId: 'review-3', skillId: 'skill-gamma', status: 'returned' }],
          },
          selectedTicketId: 'review-2',
          ticket: {
            ticketId: 'review-2',
            skillId: 'skill-beta',
            packageId: 'pkg-beta-1',
            status: 'in_progress',
            claimedBy: 'reviewer-1',
            createdAt: '2026-04-11T00:00:00.000Z',
            skill: { summary: 'Beta summary' },
          },
          history: [
            { action: 'created', fromStatus: null, toStatus: 'todo', createdAt: '2026-04-11T00:00:00.000Z' },
            { action: 'claim', fromStatus: 'todo', toStatus: 'in_progress', createdAt: '2026-04-11T00:05:00.000Z' },
          ],
        },
      },
    }),
  );

  assert.match(markup, /data-review-select="review-1"/);
  assert.match(markup, /data-review-action="claim"/);
  assert.match(markup, /data-review-action="approve"/);
  assert.match(markup, /data-review-action="reject"/);
  assert.match(markup, /data-review-action="return"/);
  assert.match(markup, /Review detail/);
  assert.match(markup, /Timeline/);
  assert.match(markup, /Beta summary/);
});

test('review page hides resolve actions when the current session user does not own the active claim', async () => {
  const markup = await renderPage(
    createState({
      session: {
        user: {
          userId: 'reviewer-2',
        },
      },
      remote: {
        review: {
          status: 'loaded',
          message: 'ok',
          queue: {
            todo: [],
            inProgress: [{ ticketId: 'review-2', skillId: 'skill-beta', status: 'in_progress' }],
            done: [],
          },
          selectedTicketId: 'review-2',
          ticket: {
            ticketId: 'review-2',
            skillId: 'skill-beta',
            packageId: 'pkg-beta-1',
            status: 'in_progress',
            claimedBy: 'reviewer-1',
            createdAt: '2026-04-11T00:00:00.000Z',
            skill: { summary: 'Beta summary' },
          },
          history: [],
        },
      },
    }),
  );

  assert.doesNotMatch(markup, /data-review-action="approve"/);
  assert.doesNotMatch(markup, /data-review-action="reject"/);
  assert.doesNotMatch(markup, /data-review-action="return"/);
});
