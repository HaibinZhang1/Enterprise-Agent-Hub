export const SKILL_EVENTS = Object.freeze({
  created: 'skill.created',
  versionSubmitted: 'skill.version.submitted',
  published: 'skill.published',
});

/**
 * @param {{
 *   skillId: string;
 *   ownerUserId: string;
 *   title: string;
 *   summary: string;
 *   visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
 *   allowedDepartmentIds?: string[];
 * }} input
 */
export function createSkillDraft(input) {
  return Object.freeze({
    skillId: input.skillId,
    ownerUserId: input.ownerUserId,
    title: input.title,
    summary: input.summary,
    visibility: input.visibility,
    allowedDepartmentIds: Object.freeze([...(input.allowedDepartmentIds ?? [])]),
    status: 'draft',
    versions: Object.freeze([]),
    publishedVersion: null,
  });
}

/**
 * @param {{
 *   skill: {
 *     skillId: string;
 *     ownerUserId: string;
 *     title: string;
 *     summary: string;
 *     visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
 *     allowedDepartmentIds: readonly string[];
 *     status: string;
 *     versions: readonly { packageId: string; version: string; submittedAt: string; status: string; publishedAt?: string }[];
 *     publishedVersion: string | null;
 *   };
 *   packageReport: { valid: boolean; packageId: string; manifest: { version: string } };
 *   submittedAt?: Date;
 * }} input
 */
export function submitSkillVersion(input) {
  if (!input.packageReport.valid) {
    throw new Error('Cannot submit skill version with an invalid package report.');
  }

  const submittedAt = input.submittedAt ?? new Date();
  const versionRecord = Object.freeze({
    packageId: input.packageReport.packageId,
    version: input.packageReport.manifest.version,
    submittedAt: submittedAt.toISOString(),
    status: 'pending_review',
  });

  return Object.freeze({
    ...input.skill,
    status: 'pending_review',
    versions: Object.freeze([...input.skill.versions, versionRecord]),
    lastEvent: SKILL_EVENTS.versionSubmitted,
  });
}

/**
 * @param {{
 *   skill: {
 *     skillId: string;
 *     ownerUserId: string;
 *     title: string;
 *     summary: string;
 *     visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
 *     allowedDepartmentIds: readonly string[];
 *     status: string;
 *     versions: readonly { version: string; packageId: string; submittedAt: string; status: string; publishedAt?: string }[];
 *     publishedVersion: string | null;
 *   };
 *   approvedAt?: Date;
 * }} input
 */
export function publishApprovedSkill(input) {
  const approvedAt = input.approvedAt ?? new Date();
  const versionCount = input.skill.versions.length;
  const latestVersion = versionCount > 0 ? input.skill.versions[versionCount - 1] : null;
  if (!latestVersion) {
    throw new Error('Cannot publish a skill without a submitted version.');
  }

  return Object.freeze({
    ...input.skill,
    status: 'published',
    publishedVersion: latestVersion.version,
    publishedAt: approvedAt.toISOString(),
    versions: Object.freeze(
      input.skill.versions.map((entry) =>
        entry.version === latestVersion.version
          ? Object.freeze({ ...entry, status: 'published', publishedAt: approvedAt.toISOString() })
          : entry,
      ),
    ),
    lastEvent: SKILL_EVENTS.published,
  });
}
