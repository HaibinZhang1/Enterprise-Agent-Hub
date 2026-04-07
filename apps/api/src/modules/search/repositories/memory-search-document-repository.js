export function createMemorySearchDocumentRepository() {
  /** @type {Map<string, ReturnType<typeof import('../core/skill-search.js').buildSkillSearchDocument>>} */
  const documents = new Map();

  return Object.freeze({
    /**
     * @param {ReturnType<typeof import('../core/skill-search.js').buildSkillSearchDocument>} document
     */
    upsert(document) {
      documents.set(document.skillId, document);
      return document;
    },

    list() {
      return Object.freeze([...documents.values()]);
    },
  });
}
