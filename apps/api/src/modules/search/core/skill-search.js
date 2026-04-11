/**
 * @param {string} query
 */
function normalizeQuery(query) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * @param {{
 *   skillId: string;
 *   title: string;
 *   summary: string;
 *   ownerUserId: string;
 *   publishedVersion: string | null;
 *   visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
 *   allowedDepartmentIds?: readonly string[];
 *   tags?: readonly string[];
 * }} skill
 */
export function buildSkillSearchDocument(skill) {
  return Object.freeze({
    skillId: skill.skillId,
    title: skill.title,
    summary: skill.summary,
    ownerUserId: skill.ownerUserId,
    publishedVersion: skill.publishedVersion,
    visibility: skill.visibility,
    allowedDepartmentIds: Object.freeze([...(skill.allowedDepartmentIds ?? [])]),
    tags: Object.freeze([...(skill.tags ?? [])]),
  });
}

/**
 * @param {{ visibility: string; ownerUserId: string; allowedDepartmentIds: readonly string[] }} document
 * @param {{ userId: string; departmentIds?: string[] }} viewer
 */
export function resolveViewerAccess(document, viewer) {
  if (document.visibility === 'private') {
    return Object.freeze({ visible: viewer.userId === document.ownerUserId, detailVisible: true, canInstall: false });
  }

  if (document.visibility === 'summary_public') {
    return Object.freeze({ visible: true, detailVisible: false, canInstall: false });
  }

  if (document.visibility === 'detail_public') {
    return Object.freeze({ visible: true, detailVisible: true, canInstall: false });
  }

  if (document.visibility === 'global_installable') {
    return Object.freeze({ visible: true, detailVisible: true, canInstall: true });
  }

  const viewerDepartments = viewer.departmentIds ?? [];
  const allowed = viewerDepartments.some((departmentId) => document.allowedDepartmentIds.includes(departmentId));
  return Object.freeze({ visible: allowed, detailVisible: allowed, canInstall: allowed });
}

/**
 * @param {{ title: string; summary: string; tags: readonly string[] }} document
 * @param {string[]} queryTokens
 */
function scoreDocument(document, queryTokens) {
  const haystack = [document.title, document.summary, ...document.tags].join(' ').toLowerCase();
  return queryTokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
}

/**
 * @param {{
 *   documents: Array<ReturnType<typeof buildSkillSearchDocument>>;
 *   viewer: { userId: string; departmentIds?: string[] };
 *   query: string;
 * }} input
 */
export function searchSkillDocuments(input) {
  const queryTokens = normalizeQuery(input.query);
  return Object.freeze(
    input.documents
      .map((document) => {
        const access = resolveViewerAccess(document, input.viewer);
        return { document, access };
      })
      .filter((entry) => entry.access.visible)
      .map((entry) => ({
        skillId: entry.document.skillId,
        title: entry.document.title,
        summary: entry.access.detailVisible ? entry.document.summary : 'Summary visible. Request access for install details.',
        publishedVersion: entry.document.publishedVersion,
        score: scoreDocument(entry.document, queryTokens),
        canInstall: entry.access.canInstall,
        detailVisible: entry.access.detailVisible,
      }))
      .filter((entry) => (queryTokens.length === 0 ? true : entry.score > 0))
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .map((entry) => Object.freeze(entry)),
  );
}
