import { AUTH_PENDING_CODE } from '@enterprise-agent-hub/contracts';
import { webPages } from './pages/index.js';

export const webSkeletonManifest = Object.freeze({
  app: 'web',
  frameworkTarget: 'React + Ant Design + TanStack Query + Zustand',
  authPendingCode: AUTH_PENDING_CODE,
  realtime: {
    preferredTransport: 'SSE',
    fallback: 'polling',
  },
  sharedStates: ['loading', 'empty', 'error', 'permission-denied'],
  pages: webPages,
});

export default webSkeletonManifest;
