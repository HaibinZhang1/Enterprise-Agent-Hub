/**
 * @param {{ authService: ReturnType<typeof import('../services/auth-service.js').createAuthService> }} input
 */
export function createAuthController(input) {
  return Object.freeze({
    /**
     * @param {{ requestId: string; username: string; password: string; clientType: 'desktop' | 'web' | 'api'; deviceLabel: string; now?: Date }} loginInput
     */
    login(loginInput) {
      return input.authService.login(loginInput);
    },

    /**
     * @param {{ requestId: string; userId: string; tokenAuthzVersion: number; sessionId?: string }} authorizeInput
     */
    authorize(authorizeInput) {
      return input.authService.authorize(authorizeInput);
    },

    /**
     * @param {{ requestId: string; userId: string; currentPassword: string; nextPassword: string; now?: Date }} changePasswordInput
     */
    changePassword(changePasswordInput) {
      return input.authService.changePassword(changePasswordInput);
    },
  });
}
