import assert from 'node:assert/strict';
import test from 'node:test';

import { createMemoryReviewTicketRepository } from '../apps/api/src/modules/review/repositories/memory-review-ticket-repository.js';

test('memory review repository preserves append-only history ordering and sequence numbers', () => {
  const repository = createMemoryReviewTicketRepository();
  repository.save({
    ticketId: 'review-1',
    skillId: 'skill-1',
    packageId: 'pkg-1',
    requestedBy: 'user-1',
    reviewerId: 'reviewer-1',
    status: 'todo',
    createdAt: '2026-04-11T00:00:00.000Z',
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
    decision: null,
    resolution: null,
    lastEvent: 'review.ticket.created',
  });

  repository.appendHistory({
    ticketId: 'review-1',
    action: 'created',
    fromStatus: null,
    toStatus: 'todo',
    actorId: 'user-1',
    comment: '',
    createdAt: '2026-04-11T00:00:00.000Z',
  });
  repository.appendHistory({
    ticketId: 'review-1',
    action: 'claim',
    fromStatus: 'todo',
    toStatus: 'in_progress',
    actorId: 'reviewer-1',
    comment: '',
    createdAt: '2026-04-11T00:05:00.000Z',
  });
  repository.appendHistory({
    ticketId: 'review-1',
    action: 'return',
    fromStatus: 'in_progress',
    toStatus: 'returned',
    actorId: 'reviewer-1',
    comment: 'Please revise and resubmit.',
    createdAt: '2026-04-11T00:10:00.000Z',
  });

  assert.deepEqual(repository.listHistory('review-1').map((entry) => [entry.sequence, entry.action, entry.toStatus]), [
    [1, 'created', 'todo'],
    [2, 'claim', 'in_progress'],
    [3, 'return', 'returned'],
  ]);
});
