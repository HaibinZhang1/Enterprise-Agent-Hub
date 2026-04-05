import { REVIEW_ACTION_EVENTS } from '../../review/core/ticket-policy.js';

/**
 * @param {{
 *   packageReport: {
 *     packageId: string;
 *     structureValid: boolean;
 *     findings: Array<{ severity: 'info' | 'warning' | 'blocking'; code: string }>;
 *   };
 *   skillDraft: {
 *     skillId: string;
 *     version: string;
 *     title: string;
 *     summary: string;
 *     description: string;
 *     allowedDepartmentIds: string[];
 *     accessLevel: 'summary' | 'detail' | 'install';
 *   };
 *   submittedBy: string;
 *   submittedAt: Date;
 * }} input
 */
export function createPackageReviewSubmission(input) {
  const blockingFindings = input.packageReport.findings.filter((finding) => finding.severity === 'blocking');
  if (!input.packageReport.structureValid || blockingFindings.length > 0) {
    return Object.freeze({
      accepted: false,
      reason: 'package_validation_failed',
      blockingFindings: Object.freeze(blockingFindings),
    });
  }

  return Object.freeze({
    accepted: true,
    reviewTicket: Object.freeze({
      id: `review-${input.skillDraft.skillId}-${input.skillDraft.version}`,
      skillId: input.skillDraft.skillId,
      status: 'todo',
      submittedAt: input.submittedAt.toISOString(),
      dueAt: new Date(input.submittedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      claimedBy: null,
      claimExpiresAt: null,
      resolution: null,
    }),
    skillVersion: Object.freeze({
      skillId: input.skillDraft.skillId,
      version: input.skillDraft.version,
      status: 'pending_review',
      packageId: input.packageReport.packageId,
      submittedBy: input.submittedBy,
      submittedAt: input.submittedAt.toISOString(),
    }),
    searchDocumentDraft: Object.freeze({
      skillId: input.skillDraft.skillId,
      title: input.skillDraft.title,
      summary: input.skillDraft.summary,
      description: input.skillDraft.description,
      allowedDepartmentIds: input.skillDraft.allowedDepartmentIds,
      accessLevel: input.skillDraft.accessLevel,
      stars: 0,
      downloads: 0,
      updatedAt: input.submittedAt.toISOString(),
    }),
  });
}

/**
 * @param {{
 *   skillVersion: {
 *     skillId: string;
 *     version: string;
 *     status: string;
 *   };
 *   searchDocumentDraft: {
 *     skillId: string;
 *     title: string;
 *     summary: string;
 *     description: string;
 *     allowedDepartmentIds: string[];
 *     accessLevel: 'summary' | 'detail' | 'install';
 *     stars: number;
 *     downloads: number;
 *     updatedAt: string;
 *   };
 *   resolvedTicket: {
 *     status: 'approved' | 'rejected' | 'returned';
 *     resolution: { resolvedBy: string; resolvedAt: string } | null;
 *   };
 * }} input
 */
export function applyReviewDecisionToSkill(input) {
  if (input.resolvedTicket.status !== 'approved') {
    return Object.freeze({
      skillVersion: Object.freeze({
        ...input.skillVersion,
        status: input.resolvedTicket.status === 'returned' ? 'changes_requested' : 'rejected',
      }),
      published: false,
      searchDocument: null,
      notifyEvent: null,
    });
  }

  const publishedAt = input.resolvedTicket.resolution?.resolvedAt ?? input.searchDocumentDraft.updatedAt;

  return Object.freeze({
    skillVersion: Object.freeze({
      ...input.skillVersion,
      status: 'published',
      publishedAt,
      approvedBy: input.resolvedTicket.resolution?.resolvedBy ?? null,
    }),
    published: true,
    searchDocument: Object.freeze({
      ...input.searchDocumentDraft,
      updatedAt: publishedAt,
    }),
    notifyEvent: Object.freeze({
      event: REVIEW_ACTION_EVENTS.approved,
      payload: {
        skillId: input.skillVersion.skillId,
        version: input.skillVersion.version,
        publishedAt,
      },
    }),
  });
}
