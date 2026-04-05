export const ORG_SCOPE_EVENTS = Object.freeze({
  assignmentChanged: 'org.user.assignment.changed',
  scopeRecalcRequested: 'org.scope.recalc.requested',
  scopeRecalcCompleted: 'org.scope.recalc.completed',
});

/**
 * @typedef {{ id: string; parentId: string | null }} DepartmentNode
 */

/**
 * @param {DepartmentNode[]} departments
 */
function buildChildrenIndex(departments) {
  /** @type {Map<string | null, string[]>} */
  const childrenByParentId = new Map();

  for (const department of departments) {
    const siblings = childrenByParentId.get(department.parentId) ?? [];
    siblings.push(department.id);
    childrenByParentId.set(department.parentId, siblings);
  }

  return childrenByParentId;
}

/**
 * @param {{ rootDepartmentId: string | null; departments: DepartmentNode[] }} input
 */
export function getManagedDepartmentIds(input) {
  if (input.rootDepartmentId === null) {
    return Object.freeze(input.departments.map((department) => department.id));
  }

  const childrenByParentId = buildChildrenIndex(input.departments);
  /** @type {string[]} */
  const managedDepartmentIds = [];
  const queue = [input.rootDepartmentId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || managedDepartmentIds.includes(currentId)) {
      continue;
    }

    managedDepartmentIds.push(currentId);
    const childIds = childrenByParentId.get(currentId) ?? [];
    queue.push(...childIds);
  }

  return Object.freeze(managedDepartmentIds);
}

/**
 * @param {{
 *   actorRoleLevel: number;
 *   actorManagedDepartmentIds: string[];
 *   targetDepartmentId: string;
 *   targetRoleLevel: number;
 * }} input
 */
export function validateAssignmentChange(input) {
  if (!input.actorManagedDepartmentIds.includes(input.targetDepartmentId)) {
    return Object.freeze({ allowed: false, reason: 'target_outside_managed_scope' });
  }

  if (input.targetRoleLevel < input.actorRoleLevel) {
    return Object.freeze({ allowed: false, reason: 'target_role_above_actor' });
  }

  return Object.freeze({ allowed: true });
}

/**
 * @param {{
 *   affectedUserIds: string[];
 *   currentAuthzVersion: number;
 *   reason: string;
 * }} input
 */
export function planScopeConvergence(input) {
  const impactedUserIds = Array.from(new Set(input.affectedUserIds)).sort();
  const targetAuthzVersion = input.currentAuthzVersion + 1;

  return Object.freeze({
    impactedUserIds,
    authzTargetVersion: targetAuthzVersion,
    markPending: true,
    reason: input.reason,
    requestedEvent: ORG_SCOPE_EVENTS.scopeRecalcRequested,
    completedEvent: ORG_SCOPE_EVENTS.scopeRecalcCompleted,
  });
}
