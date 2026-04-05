import { AUTH_PENDING_CODE } from '@enterprise-agent-hub/contracts';
import { apiDomains } from './modules/index.js';

export const apiSkeletonManifest = Object.freeze({
  app: 'api',
  frameworkTarget: 'NestJS modular monolith',
  transport: ['REST', 'SSE'],
  requestContext: {
    requestIdHeader: 'x-request-id',
    authPendingCode: AUTH_PENDING_CODE,
    outboxStrategy: 'database-outbox-worker',
  },
  layers: ['controllers', 'services', 'repositories', 'events'],
  domains: apiDomains,
});

export default apiSkeletonManifest;
