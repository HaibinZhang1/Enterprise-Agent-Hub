import { createSkillDraft, publishApprovedSkill, resolveSubmittedSkillVersion, submitSkillVersion } from '../core/catalog-policy.js';

/**
 * @param {{
 *   skillCatalogRepository: ReturnType<typeof import('../repositories/memory-skill-catalog-repository.js').createMemorySkillCatalogRepository>;
 *   auditService: ReturnType<typeof import('../../audit/services/audit-service.js').createAuditService>;
 * }} input
 */
export function createSkillCatalogService(input) {
  /**
   * @param {string} skillId
   */
  function requireSkill(skillId) {
    const skill = input.skillCatalogRepository.get(skillId);
    if (!skill) {
      throw new Error(`Unknown skill: ${skillId}`);
    }
    return skill;
  }

  return Object.freeze({
    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   skillId: string;
     *   packageReport: { valid: boolean; packageId: string; manifest: { version: string; title: string; summary: string } };
     *   visibility: 'private' | 'summary_public' | 'detail_public' | 'department' | 'global_installable';
     *   allowedDepartmentIds?: string[];
     *   now?: Date;
     * }} submitInput
     */
    submitVersion(submitInput) {
      const existingSkill =
        input.skillCatalogRepository.get(submitInput.skillId) ??
        createSkillDraft({
          skillId: submitInput.skillId,
          ownerUserId: submitInput.actor.userId,
          title: submitInput.packageReport.manifest.title,
          summary: submitInput.packageReport.manifest.summary,
          visibility: submitInput.visibility,
          allowedDepartmentIds: submitInput.allowedDepartmentIds,
        });
      const submittedSkill = input.skillCatalogRepository.save(
        submitSkillVersion({
          skill: existingSkill,
          packageReport: submitInput.packageReport,
          submittedAt: submitInput.now,
        }),
      );
      input.auditService.record({
        requestId: submitInput.requestId,
        actor: submitInput.actor,
        targetType: 'skill',
        targetId: submitInput.skillId,
        action: 'skill.version.submitted',
        details: { packageId: submitInput.packageReport.packageId },
        occurredAt: submitInput.now,
      });
      return submittedSkill;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   skillId: string;
     *   now?: Date;
     * }} publishInput
     */
    publishApproved(publishInput) {
      const publishedSkill = input.skillCatalogRepository.save(
        publishApprovedSkill({
          skill: requireSkill(publishInput.skillId),
          approvedAt: publishInput.now,
        }),
      );
      return publishedSkill;
    },

    /**
     * @param {{
     *   requestId: string;
     *   actor: { userId: string; username: string; roleCode: string; departmentId?: string | null };
     *   skillId: string;
     *   action: 'reject' | 'return';
     *   now?: Date;
     * }} resolveInput
     */
    resolveSubmittedVersion(resolveInput) {
      const resolvedSkill = input.skillCatalogRepository.save(
        resolveSubmittedSkillVersion({
          skill: requireSkill(resolveInput.skillId),
          action: resolveInput.action,
          resolvedAt: resolveInput.now,
        }),
      );
      input.auditService.record({
        requestId: resolveInput.requestId,
        actor: resolveInput.actor,
        targetType: 'skill',
        targetId: resolveInput.skillId,
        action: `skill.version.${resolveInput.action}ed`,
        details: { action: resolveInput.action },
        occurredAt: resolveInput.now,
      });
      return resolvedSkill;
    },

    /**
     * @param {string} ownerUserId
     */
    listOwnedSkills(ownerUserId) {
      return Object.freeze(input.skillCatalogRepository.list().filter((skill) => skill.ownerUserId === ownerUserId));
    },

    /**
     * @param {{ actor: { roleCode: string; departmentId?: string | null } }} inputValue
     */
    listManageableSkills(inputValue) {
      const isGlobalAdmin = inputValue.actor.roleCode.startsWith('system_admin');
      return Object.freeze(
        input.skillCatalogRepository.list().filter((skill) => {
          if (isGlobalAdmin) {
            return true;
          }
          if (inputValue.actor.departmentId === null || inputValue.actor.departmentId === undefined) {
            return false;
          }
          return skill.allowedDepartmentIds.includes(inputValue.actor.departmentId);
        }),
      );
    },

    /**
     * @param {string} skillId
     */
    getSkill(skillId) {
      return requireSkill(skillId);
    },
  });
}
