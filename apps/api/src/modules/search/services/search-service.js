import { buildSkillSearchDocument, searchSkillDocuments } from '../core/skill-search.js';

/**
 * @param {{
 *   searchDocumentRepository: ReturnType<typeof import('../repositories/memory-search-document-repository.js').createMemorySearchDocumentRepository>;
 * }} input
 */
export function createSearchService(input) {
  return Object.freeze({
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
    upsertSkill(skill) {
      return input.searchDocumentRepository.upsert(buildSkillSearchDocument(skill));
    },

    /**
     * @param {{ viewer: { userId: string; departmentIds?: string[] }; query: string }} searchInput
     */
    search(searchInput) {
      return searchSkillDocuments({
        documents: [...input.searchDocumentRepository.list()],
        viewer: searchInput.viewer,
        query: searchInput.query,
      });
    },
  });
}
