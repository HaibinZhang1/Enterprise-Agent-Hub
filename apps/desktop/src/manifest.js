import { SOURCE_OF_TRUTH_MATRIX_FIXTURE } from '@enterprise-agent-hub/contracts';
import { desktopModules } from './modules/index.js';

export const desktopSkeletonManifest = Object.freeze({
  app: 'desktop',
  frameworkTarget: 'Tauri 2 desktop shell',
  sessionStorageRule: 'refresh tokens stay in OS secure storage and never in SQLite',
  authorityModel: SOURCE_OF_TRUTH_MATRIX_FIXTURE,
  modules: desktopModules,
});

export default desktopSkeletonManifest;
