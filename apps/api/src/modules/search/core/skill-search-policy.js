/**
 * @typedef {{
 *   skillId: string;
 *   title: string;
 *   summary: string;
 *   description: string;
 *   allowedDepartmentIds: string[];
 *   accessLevel: 'summary' | 'detail' | 'install';
 *   stars: number;
 *   downloads: number;
 *   updatedAt: string;
 * }} SearchDocument
 */

/**
 * @param {SearchDocument} document
 * @param {{ departmentId: string }} viewer
 */
function projectDocumentVisibility(document, viewer) {
  if (!document.allowedDepartmentIds.includes(viewer.departmentId)) {
    return null;
  }

  return Object.freeze({
    skillId: document.skillId,
    title: document.title,
    summary: document.summary,
    description: document.accessLevel === 'summary' ? undefined : document.description,
    accessLevel: document.accessLevel,
    canInstall: document.accessLevel === 'install',
    stars: document.stars,
    downloads: document.downloads,
    updatedAt: document.updatedAt,
  });
}

/**
 * @param {{ document: SearchDocument; query: string }} input
 */
function scoreDocument(input) {
  const query = input.query.trim().toLowerCase();
  const title = input.document.title.toLowerCase();
  const summary = input.document.summary.toLowerCase();
  const description = input.document.description.toLowerCase();

  let score = input.document.stars * 2 + input.document.downloads;

  if (query.length > 0) {
    if (title.includes(query)) {
      score += 30;
    }
    if (summary.includes(query)) {
      score += 20;
    }
    if (description.includes(query)) {
      score += 10;
    }
  }

  return score;
}

/**
 * @param {{
 *   documents: SearchDocument[];
 *   viewer: { departmentId: string };
 *   query: string;
 * }} input
 */
export function searchSkills(input) {
  const visibleDocuments = input.documents
    .map((document) => {
      const projected = projectDocumentVisibility(document, input.viewer);
      if (!projected) {
        return null;
      }

      return Object.freeze({
        ...projected,
        score: scoreDocument({ document, query: input.query }),
      });
    })
    .filter((document) => document !== null)
    .sort((left, right) => right.score - left.score || right.downloads - left.downloads);

  return Object.freeze(visibleDocuments);
}

/**
 * @param {{
 *   documents: SearchDocument[];
 *   viewer: { departmentId: string };
 *   limit?: number;
 * }} input
 */
export function buildLeaderboard(input) {
  return Object.freeze(
    searchSkills({ documents: input.documents, viewer: input.viewer, query: '' }).slice(0, input.limit ?? 20),
  );
}
