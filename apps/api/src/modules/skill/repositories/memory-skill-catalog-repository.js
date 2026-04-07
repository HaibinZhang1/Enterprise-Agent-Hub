export function createMemorySkillCatalogRepository() {
  /** @type {Map<string, any>} */
  const skills = new Map();

  return Object.freeze({
    /**
     * @param {any} skill
     */
    save(skill) {
      skills.set(skill.skillId, skill);
      return skill;
    },

    /**
     * @param {string} skillId
     */
    get(skillId) {
      return skills.get(skillId) ?? null;
    },

    list() {
      return Object.freeze([...skills.values()]);
    },
  });
}
