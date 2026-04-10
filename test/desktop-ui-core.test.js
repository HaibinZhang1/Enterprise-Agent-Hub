import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiClient, ApiError, classifyResponse } from '../apps/desktop/ui/core/api.js';
import { createEventsController } from '../apps/desktop/ui/core/events.js';
import { getVisiblePages, resolvePageRoute as _unused } from '../apps/desktop/ui/core/router.js';
import { getDefaultPage, getSafeFallback, getVisiblePages as getVisiblePageEntries, resolvePageRoute } from '../apps/desktop/ui/core/page-registry.js';
