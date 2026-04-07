/**
 * @param {{ localStateStore: ReturnType<typeof import('./local-state-store.js').createLocalStateStore> }} input
 */
export function createConflictResolverRuntime(input) {
  return Object.freeze({
    /**
     * @param {{ installId: string; target: { type: 'tool' | 'project'; id: string } }} request
     */
    detectConflict(request) {
      const occupant = input.localStateStore.getOccupant(request.target);
      if (!occupant || occupant.installId === request.installId) {
        return null;
      }
      const targetKey = `${request.target.type}:${request.target.id}`;
      const previousResolution = input
        .localStateStore
        .listConflictResolutions(request.installId)
        .find((entry) => entry.targetKey === targetKey && entry.decision === 'overwrite');
      if (previousResolution) {
        input.localStateStore.occupyTarget(request.target, { installId: request.installId, source: 'desktop' });
        return null;
      }
      return Object.freeze({
        installId: request.installId,
        targetKey,
        occupiedBy: occupant.installId,
        suggestedDecision: 'overwrite',
      });
    },

    /**
     * @param {{ installId: string; target: { type: 'tool' | 'project'; id: string }; decision: 'overwrite' | 'cancel'; now?: Date }} request
     */
    resolveConflict(request) {
      const now = request.now ?? new Date();
      const targetKey = `${request.target.type}:${request.target.id}`;
      const resolution = input.localStateStore.saveConflictResolution({
        installId: request.installId,
        targetKey,
        decision: request.decision,
        decidedAt: now.toISOString(),
      });
      if (request.decision === 'overwrite') {
        input.localStateStore.occupyTarget(request.target, { installId: request.installId, source: 'desktop' });
      }
      return resolution;
    },
  });
}
