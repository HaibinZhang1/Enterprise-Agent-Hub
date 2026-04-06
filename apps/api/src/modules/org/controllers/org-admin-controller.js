/**
 * @param {{ orgGovernanceService: ReturnType<typeof import('../services/org-governance-service.js').createOrgGovernanceService> }} input
 */
export function createOrgAdminController(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; departmentId: string | null; roleCode: string; now?: Date }} reassignInput
     */
    reassignUser(reassignInput) {
      return input.orgGovernanceService.reassignUser(reassignInput);
    },

    /**
     * @param {{ requestId: string; actor: { userId: string; username: string; roleCode: string; departmentId?: string | null }; userId: string; now?: Date }} convergenceInput
     */
    completeScopeConvergence(convergenceInput) {
      return input.orgGovernanceService.completeScopeConvergence(convergenceInput);
    },
  });
}
