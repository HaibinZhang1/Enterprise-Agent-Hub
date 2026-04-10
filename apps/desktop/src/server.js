// @ts-nocheck
import { createServer } from 'node:http';
import { constants as fsConstants } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createLocalSqliteStore } from './local-sqlite-store.js';

const moduleFile = fileURLToPath(import.meta.url);
const packageRoot = dirname(moduleFile);
const uiRoot = resolve(packageRoot, '..', 'ui');
const STATIC_CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
});

const DEFAULT_TOOL_COMMANDS = Object.freeze(['node', 'pnpm', 'git', 'python3', 'sqlite3', 'cargo']);
const DEFAULT_TOOL_LABELS = Object.freeze({
  node: 'Node.js',
  pnpm: 'pnpm',
  git: 'Git',
  python3: 'Python 3',
  sqlite3: 'SQLite 3',
  cargo: 'Rust Cargo',
});
const DEFAULT_SETTINGS = Object.freeze({
  defaultProjectBehavior: 'last-active',
  appearance: 'system',
  updateChannel: 'stable',
});

export const BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS = Object.freeze([
  'previewId',
  'action',
  'targetType',
  'targetId',
  'skillId',
  'currentSummary',
  'incomingSummary',
  'currentSkillsDirectory',
  'incomingSkillsDirectory',
  'effectiveVersion',
  'plannedFilesystemOperations',
  'fallbackMode',
  'consequenceSummary',
  'issues',
]);

export const BINDING_MATERIALIZATION_MUTATION_ACTIONS = Object.freeze([
  'bind-skill-target',
  'unbind-skill-target',
  'enable-skill-target-binding',
  'disable-skill-target-binding',
  'enable-target-materialization',
  'disable-target-materialization',
  'configure-target-skills-directory',
  'reconcile-target-materialization',
  'resolve-binding-version-conflict',
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on('error', rejectBody);
  });
}

function routeSegments(pathname) {
  return pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
}

function projectIdFrom(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `project-${randomUUID().slice(0, 8)}`;
}

function normalizeScanCommands(value) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const normalized = [...new Set(raw.map((entry) => String(entry).trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : [...DEFAULT_TOOL_COMMANDS];
}

function stateKey(name) {
  return `desktop:${name}`;
}

function hasPreviewField(preview, field) {
  if (!Object.hasOwn(preview, field)) {
    return false;
  }
  const value = preview[field];
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return true;
  }
  return true;
}

export function isBindingMaterializationMutationAction(action) {
  return BINDING_MATERIALIZATION_MUTATION_ACTIONS.includes(String(action ?? ''));
}

export function validateBindingMaterializationPreview(preview) {
  if (!preview || typeof preview !== 'object') {
    return Object.freeze({
      ok: false,
      reason: 'missing_preview',
      missingFields: [...BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS],
    });
  }
  const missingFields = BINDING_MATERIALIZATION_PREVIEW_REQUIRED_FIELDS.filter((field) => !hasPreviewField(preview, field));
  if (missingFields.length > 0) {
    return Object.freeze({ ok: false, reason: 'incomplete_preview', missingFields });
  }
  if (!isBindingMaterializationMutationAction(preview.action)) {
    return Object.freeze({ ok: false, reason: 'unsupported_binding_materialization_action', missingFields: [] });
  }
  if (!['tool', 'project'].includes(preview.targetType)) {
    return Object.freeze({ ok: false, reason: 'invalid_target_type', missingFields: [] });
  }
  if (!Array.isArray(preview.plannedFilesystemOperations) || preview.plannedFilesystemOperations.length === 0) {
    return Object.freeze({ ok: false, reason: 'invalid_planned_filesystem_operations', missingFields: [] });
  }
  return Object.freeze({ ok: true, reason: 'valid_preview', missingFields: [] });
}

export function validatePreviewConfirmation(input) {
  const body = input.body ?? {};
  const preview = input.preview;
  if (!body.previewId || !preview || preview.previewId !== body.previewId) {
    return Object.freeze({ ok: false, reason: 'invalid_preview' });
  }
  if (input.action && preview.action !== input.action) {
    return Object.freeze({ ok: false, reason: 'invalid_preview' });
  }
  if (input.targetKey && preview.targetKey !== input.targetKey) {
    return Object.freeze({ ok: false, reason: 'invalid_preview' });
  }
  if (input.targetType && preview.targetType !== input.targetType) {
    return Object.freeze({ ok: false, reason: 'invalid_preview' });
  }
  if (input.targetId && preview.targetId !== input.targetId) {
    return Object.freeze({ ok: false, reason: 'invalid_preview' });
  }
  if (input.skillId && preview.skillId !== input.skillId) {
    return Object.freeze({ ok: false, reason: 'invalid_preview' });
  }
  if (input.requireBindingMaterializationPreview) {
    return validateBindingMaterializationPreview(preview);
  }
  return Object.freeze({ ok: true, reason: 'valid_preview' });
}

function resolveStaticAsset(pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const candidate = resolve(uiRoot, `.${normalized}`);
  if (!candidate.startsWith(uiRoot)) {
    return null;
  }
  const type = STATIC_CONTENT_TYPES[extname(candidate)] ?? 'application/octet-stream';
  return Object.freeze({ filePath: candidate, type });
}

async function inspectPath(targetPath) {
  const normalizedPath = resolve(String(targetPath ?? '').trim() || '.');
  try {
    const details = await stat(normalizedPath);
    let writable = true;
    try {
      await access(normalizedPath, fsConstants.W_OK);
    } catch {
      writable = false;
    }
    const directory = details.isDirectory();
    const healthState = !directory ? 'invalid' : writable ? 'ready' : 'read_only';
    const issues = [];
    if (!directory) {
      issues.push('Path is not a directory.');
    }
    if (!writable) {
      issues.push('Path is not writable by the desktop shell.');
    }
    return Object.freeze({
      normalizedPath,
      exists: true,
      directory,
      writable,
      healthState,
      issues,
    });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return Object.freeze({
        normalizedPath,
        exists: false,
        directory: false,
        writable: false,
        healthState: 'missing',
        issues: ['Path does not exist on this machine.'],
      });
    }
    return Object.freeze({
      normalizedPath,
      exists: false,
      directory: false,
      writable: false,
      healthState: 'invalid',
      issues: [error instanceof Error ? error.message : 'Path validation failed.'],
    });
  }
}

function findExecutable(command) {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function inspectTool(command) {
  const installPath = findExecutable(command);
  if (!installPath) {
    return Object.freeze({
      command,
      displayName: DEFAULT_TOOL_LABELS[command] ?? command,
      installPath: 'Not found',
      exists: false,
      writable: false,
      healthState: 'missing',
      issues: ['Tool is not currently discoverable on PATH.'],
    });
  }

  let writable = true;
  try {
    await access(installPath, fsConstants.W_OK);
  } catch {
    writable = false;
  }

  return Object.freeze({
    command,
    displayName: DEFAULT_TOOL_LABELS[command] ?? command,
    installPath,
    exists: true,
    writable,
    healthState: writable ? 'ready' : 'read_only',
    issues: writable ? [] : ['Discovered binary is not writable by the desktop shell.'],
  });
}

function healthSummary(healthState) {
  switch (healthState) {
    case 'ready':
      return 'Ready';
    case 'read_only':
      return 'Read-only';
    case 'missing':
      return 'Missing';
    case 'conflict':
      return 'Conflict';
    case 'invalid':
      return 'Invalid';
    default:
      return healthState;
  }
}

export async function createDesktopServer(config = {}) {
  const port = Number(config.port ?? process.env.DESKTOP_PORT ?? 4174);
  const configuredApiBaseUrl =
    config.apiBaseUrl ??
    process.env.DESKTOP_API_BASE_URL ??
    process.env.API_BASE_URL ??
    'http://127.0.0.1:8787';
  const sqlitePath = config.sqlitePath ?? process.env.DESKTOP_SQLITE_PATH ?? resolve(packageRoot, '..', '.local', 'desktop.db');
  const store = createLocalSqliteStore({ sqlitePath });
  let sessionState = null;
  let desktopSettings = null;
  let runtimeApiBaseUrl = configuredApiBaseUrl;

  function loadDesktopSettings() {
    const saved = store.getState(stateKey('settings'))?.payload ?? {};
    const scanCommands = normalizeScanCommands(saved.scanCommands ?? DEFAULT_TOOL_COMMANDS);
    return Object.freeze({
      apiBaseUrl: String(saved.apiBaseUrl ?? configuredApiBaseUrl).trim() || configuredApiBaseUrl,
      scanCommands: scanCommands.length > 0 ? scanCommands : [...DEFAULT_TOOL_COMMANDS],
      defaultProjectBehavior: String(saved.defaultProjectBehavior ?? DEFAULT_SETTINGS.defaultProjectBehavior),
      appearance: String(saved.appearance ?? DEFAULT_SETTINGS.appearance),
      updateChannel: String(saved.updateChannel ?? DEFAULT_SETTINGS.updateChannel),
    });
  }

  function persistDesktopSettings(nextSettings) {
    desktopSettings = Object.freeze({
      apiBaseUrl: String(nextSettings.apiBaseUrl ?? configuredApiBaseUrl).trim() || configuredApiBaseUrl,
      scanCommands: normalizeScanCommands(nextSettings.scanCommands),
      defaultProjectBehavior: String(nextSettings.defaultProjectBehavior ?? DEFAULT_SETTINGS.defaultProjectBehavior),
      appearance: String(nextSettings.appearance ?? DEFAULT_SETTINGS.appearance),
      updateChannel: String(nextSettings.updateChannel ?? DEFAULT_SETTINGS.updateChannel),
    });
    runtimeApiBaseUrl = desktopSettings.apiBaseUrl;
    store.saveState(stateKey('settings'), desktopSettings);
    return desktopSettings;
  }

  function getCurrentProjectState() {
    return store.getState(stateKey('current-project'))?.payload ?? null;
  }

  function setCurrentProject(projectId) {
    const payload = projectId ? { projectId, updatedAt: new Date().toISOString() } : null;
    if (!payload) {
      store.deleteState(stateKey('current-project'));
      return null;
    }
    store.saveState(stateKey('current-project'), payload);
    return payload;
  }

  function getPreview(previewId) {
    return store.getState(stateKey(`preview:${previewId}`))?.payload ?? null;
  }

  function savePreview(preview) {
    store.saveState(stateKey(`preview:${preview.previewId}`), preview);
    return preview;
  }

  function deletePreview(previewId) {
    store.deleteState(stateKey(`preview:${previewId}`));
  }

  async function proxyJson(pathname, options = {}) {
    const headers = {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    };
    if (sessionState?.sessionId) {
      headers.authorization = `Bearer ${sessionState.sessionId}`;
    }
    const response = await fetch(`${runtimeApiBaseUrl}${pathname}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json();
    return { status: response.status, data };
  }

  async function proxyBinary(pathname, options = {}) {
    const headers = {
      ...(options.headers ?? {}),
    };
    if (sessionState?.sessionId) {
      headers.authorization = `Bearer ${sessionState.sessionId}`;
    }
    const response = await fetch(`${runtimeApiBaseUrl}${pathname}`, {
      method: options.method ?? 'GET',
      headers,
    });
    const body = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      contentDisposition: response.headers.get('content-disposition'),
    };
  }

  async function scanTools() {
    const commands = normalizeScanCommands(desktopSettings?.scanCommands ?? DEFAULT_TOOL_COMMANDS);
    const knownIds = new Set(commands);
    for (const row of store.listTools()) {
      if (!knownIds.has(row.toolId)) {
        store.deleteTool(row.toolId);
      }
    }
    for (const command of commands) {
      const inspected = await inspectTool(command);
      store.saveTool({
        toolId: inspected.command,
        displayName: inspected.displayName,
        installPath: inspected.installPath,
        healthState: inspected.healthState,
      });
    }
    return listToolsModel();
  }

  async function listToolsModel() {
    const rows = store.listTools();
    if (rows.length === 0) {
      return scanTools();
    }
    const pathOwners = new Map();
    for (const row of rows) {
      if (row.installPath && row.installPath !== 'Not found') {
        const owners = pathOwners.get(row.installPath) ?? [];
        owners.push(row.toolId);
        pathOwners.set(row.installPath, owners);
      }
    }
    return rows.map((row) => {
      const conflicts = pathOwners.get(row.installPath) ?? [];
      const healthState = conflicts.length > 1 ? 'conflict' : row.healthState;
      const issues = [];
      if (healthState === 'conflict') {
        issues.push(`Path is shared with ${conflicts.filter((toolId) => toolId !== row.toolId).join(', ')}.`);
      }
      if (healthState === 'missing') {
        issues.push('Tool is not currently discoverable on PATH.');
      }
      if (healthState === 'read_only') {
        issues.push('Discovered binary is not writable by the desktop shell.');
      }
      return Object.freeze({
        toolId: row.toolId,
        displayName: row.displayName,
        installPath: row.installPath,
        skillsDirectory: row.skillsDirectory,
        materializationEnabled: Boolean(row.materializationEnabled),
        healthState,
        healthLabel: healthSummary(healthState),
        updatedAt: row.updatedAt,
        issues,
        actions: Object.freeze({
          canRepair: healthState !== 'ready',
          canRescan: true,
          canMaterialize: Boolean(row.materializationEnabled) && healthState === 'ready',
        }),
      });
    });
  }

  async function enrichProject(project, rows, currentProjectId) {
    const validation = await inspectPath(project.projectPath);
    const conflictingProjectIds = rows
      .filter((row) => row.projectId !== project.projectId && resolve(row.projectPath) === validation.normalizedPath)
      .map((row) => row.projectId);
    const healthState = conflictingProjectIds.length > 0 ? 'conflict' : validation.healthState;
    const issues = [...validation.issues];
    if (conflictingProjectIds.length > 0) {
      issues.unshift(`Registered path conflicts with ${conflictingProjectIds.join(', ')}.`);
    }
    return Object.freeze({
      projectId: project.projectId,
      displayName: project.displayName,
      projectPath: validation.normalizedPath,
      skillsDirectory: project.skillsDirectory,
      healthState,
      healthLabel: healthSummary(healthState),
      updatedAt: project.updatedAt,
      isCurrent: currentProjectId === project.projectId,
      validation: {
        exists: validation.exists,
        directory: validation.directory,
        writable: validation.writable,
      },
      conflictingProjectIds,
      skillBindings: store.listSkillTargetBindings({ targetType: 'project', targetId: project.projectId }).map((binding) => Object.freeze({
        targetType: binding.targetType,
        targetId: binding.targetId,
        skillId: binding.skillId,
        packageId: binding.packageId,
        version: binding.version,
        enabled: binding.enabled,
        materializationStatus: store.getSkillMaterializationStatus({
          targetType: binding.targetType,
          targetId: binding.targetId,
          skillId: binding.skillId,
        }),
      })),
      issues,
      skillBindings: store.listSkillTargetBindings({ targetType: 'project', targetId: project.projectId }).map((binding) => Object.freeze({
        targetType: binding.targetType,
        targetId: binding.targetId,
        skillId: binding.skillId,
        packageId: binding.packageId,
        version: binding.version,
        enabled: binding.enabled,
        materializationStatus: store.getSkillMaterializationStatus({
          targetType: binding.targetType,
          targetId: binding.targetId,
          skillId: binding.skillId,
        }),
      })),
      actions: Object.freeze({ canSwitch: true, canRepair: healthState !== 'ready', canRemove: true, canRescan: true }),
    });
  }

  async function listProjectsModel() {
    const rows = store.listProjects();
    const currentProjectId = getCurrentProjectState()?.projectId ?? null;
    const projects = await Promise.all(rows.map((row) => enrichProject(row, rows, currentProjectId)));
    if (currentProjectId && !projects.some((project) => project.projectId === currentProjectId)) {
      setCurrentProject(null);
    }
    return projects;
  }

  async function getProjectModel(projectId) {
    const rows = store.listProjects();
    const currentProjectId = getCurrentProjectState()?.projectId ?? null;
    const row = rows.find((entry) => entry.projectId === projectId);
    if (!row) {
      return null;
    }
    return enrichProject(row, rows, currentProjectId);
  }

  function settingsModel() {
    return Object.freeze({
      execution: {
        apiBaseUrl: runtimeApiBaseUrl,
        scanCommands: [...desktopSettings.scanCommands],
        defaultProjectBehavior: desktopSettings.defaultProjectBehavior,
      },
      desktop: {
        appearance: desktopSettings.appearance,
        updateChannel: desktopSettings.updateChannel,
      },
      account: {
        currentSessionUser: sessionState?.user ?? null,
        lastSignedInUser: store.getState('last-user')?.payload ?? null,
      },
      storage: {
        mode: 'managed_sqlite',
        summary: 'SQLite storage is managed internally by the desktop shell and stays hidden from product settings.',
      },
    });
  }

  function requireSession(response) {
    if (!sessionState?.sessionId) {
      sendJson(response, 401, { ok: false, reason: 'session_required' });
      return false;
    }
    return true;
  }

  function createPreviewPayload(input) {
    return savePreview(
      Object.freeze({
        previewId: randomUUID(),
        createdAt: new Date().toISOString(),
        ...input,
      }),
    );
  }

  const proxyRoutes = new Map([
    ['/api/market', '/api/market'],
    ['/api/notifications', '/api/notifications'],
    ['/api/users', '/api/users'],
    ['/api/skills/my', '/api/skills/my'],
    ['/api/skills/manageable', '/api/skills/manageable'],
    ['/api/reviews', '/api/reviews'],
  ]);

  await store.init();
  sessionState = store.getState('session')?.payload ?? null;
  desktopSettings = loadDesktopSettings();
  runtimeApiBaseUrl = desktopSettings.apiBaseUrl;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);

    try {
      if (request.method === 'GET' && !url.pathname.startsWith('/api/') && url.pathname !== '/health') {
        const staticAsset = resolveStaticAsset(url.pathname === '/style.css' ? '/styles.css' : url.pathname);
        if (staticAsset) {
          try {
            const body = await readFile(staticAsset.filePath, 'utf8');
            response.writeHead(200, { 'content-type': staticAsset.type, 'cache-control': 'no-store' });
            response.end(body);
            return;
          } catch (error) {
            if (error?.code !== 'ENOENT') {
              throw error;
            }
          }
        }
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          service: '@enterprise-agent-hub/desktop',
          port,
          apiBaseUrl: runtimeApiBaseUrl,
          sqlitePath,
          cacheEntries: store.listCaches().length,
        });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/session') {
        sendJson(response, 200, {
          ok: true,
          session: sessionState,
          lastUser: store.getState('last-user')?.payload ?? null,
          caches: store.listCaches(),
        });
        return;
      }

      const segments = routeSegments(url.pathname);

      if (request.method === 'GET' && url.pathname === '/api/tools') {
        const tools = await listToolsModel();
        sendJson(response, 200, { ok: true, tools });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/tools/scan') {
        const tools = await scanTools();
        sendJson(response, 200, { ok: true, tools, scannedAt: new Date().toISOString() });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'tools' && segments[3] === 'repair-preview') {
        const toolId = segments[2];
        const currentTool = store.getTool(toolId);
        if (!currentTool) {
          sendJson(response, 404, { ok: false, reason: 'tool_not_found' });
          return;
        }
        const incoming = await inspectTool(toolId);
        const preview = createPreviewPayload({
          action: 'repair-tool',
          installId: toolId,
          target: 'tool',
          targetKey: `tool:${toolId}`,
          occupiedBy: currentTool.installPath !== incoming.installPath ? currentTool.installPath : null,
          suggestedDecision: 'refresh_tool_cache',
          currentLocalSummary: {
            displayName: currentTool.displayName,
            installPath: currentTool.installPath,
            healthState: currentTool.healthState,
          },
          incomingSummary: {
            displayName: incoming.displayName,
            installPath: incoming.installPath,
            healthState: incoming.healthState,
            issues: incoming.issues,
          },
          consequenceSummary: `Desktop will refresh ${currentTool.displayName} from ${currentTool.installPath} to ${incoming.installPath}.`,
        });
        sendJson(response, 200, { ok: true, preview });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'tools' && segments[3] === 'repair') {
        const toolId = segments[2];
        const body = await parseBody(request);
        const preview = getPreview(body.previewId);
        const confirmation = validatePreviewConfirmation({ body, preview, action: 'repair-tool', targetKey: `tool:${toolId}` });
        if (!confirmation.ok) {
          sendJson(response, 409, { ok: false, reason: confirmation.reason });
          return;
        }
        const incoming = await inspectTool(toolId);
        const tool = store.saveTool({
          toolId,
          displayName: incoming.displayName,
          installPath: incoming.installPath,
          healthState: incoming.healthState,
        });
        deletePreview(preview.previewId);
        sendJson(response, 200, { ok: true, tool });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/projects') {
        const projects = await listProjectsModel();
        sendJson(response, 200, {
          ok: true,
          projects,
          currentProjectId: getCurrentProjectState()?.projectId ?? null,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/projects') {
        const body = await parseBody(request);
        const validation = await inspectPath(body.projectPath);
        const displayName = String(body.displayName ?? '').trim() || validation.normalizedPath.split('/').filter(Boolean).at(-1) || 'Project';
        const projectId = projectIdFrom(body.projectId ?? displayName);
        store.saveProject({
          projectId,
          displayName,
          projectPath: validation.normalizedPath,
          healthState: validation.healthState,
          skillsDirectory: body.skillsDirectory ? resolve(String(body.skillsDirectory)) : resolve(validation.normalizedPath, 'skills'),
        });
        if (desktopSettings.defaultProjectBehavior === 'last-active' && !getCurrentProjectState()?.projectId) {
          setCurrentProject(projectId);
        }
        const project = await getProjectModel(projectId);
        sendJson(response, 200, { ok: true, project });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'validate') {
        const projectId = segments[2];
        const existing = store.getProject(projectId);
        if (!existing) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        const validation = await inspectPath(existing.projectPath);
        store.saveProject({
          projectId,
          displayName: existing.displayName,
          projectPath: validation.normalizedPath,
          healthState: validation.healthState,
          skillsDirectory: existing.skillsDirectory,
        });
        sendJson(response, 200, { ok: true, project: await getProjectModel(projectId) });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'rescan') {
        const projectId = segments[2];
        const existing = store.getProject(projectId);
        if (!existing) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        const validation = await inspectPath(existing.projectPath);
        store.saveProject({
          projectId,
          displayName: existing.displayName,
          projectPath: validation.normalizedPath,
          healthState: validation.healthState,
          skillsDirectory: existing.skillsDirectory,
        });
        sendJson(response, 200, { ok: true, project: await getProjectModel(projectId) });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'switch-preview') {
        const projectId = segments[2];
        const targetProject = await getProjectModel(projectId);
        if (!targetProject) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        const currentProjectId = getCurrentProjectState()?.projectId ?? null;
        const currentProject = currentProjectId ? await getProjectModel(currentProjectId) : null;
        const preview = createPreviewPayload({
          action: 'switch-project',
          installId: projectId,
          target: 'project',
          targetKey: `project:${projectId}`,
          occupiedBy: currentProject?.projectId ?? null,
          suggestedDecision: 'switch_project',
          currentLocalSummary: currentProject
            ? {
                projectId: currentProject.projectId,
                displayName: currentProject.displayName,
                projectPath: currentProject.projectPath,
                healthState: currentProject.healthState,
              }
            : {
                projectId: null,
                displayName: 'No active project',
                projectPath: null,
                healthState: 'empty',
              },
          incomingSummary: {
            projectId: targetProject.projectId,
            displayName: targetProject.displayName,
            projectPath: targetProject.projectPath,
            healthState: targetProject.healthState,
          },
          consequenceSummary: `Desktop will switch the active project to ${targetProject.displayName}.`,
        });
        sendJson(response, 200, { ok: true, preview });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'switch') {
        const projectId = segments[2];
        const body = await parseBody(request);
        const preview = getPreview(body.previewId);
        const confirmation = validatePreviewConfirmation({ body, preview, action: 'switch-project', targetKey: `project:${projectId}` });
        if (!confirmation.ok) {
          sendJson(response, 409, { ok: false, reason: confirmation.reason });
          return;
        }
        const project = await getProjectModel(projectId);
        if (!project) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        setCurrentProject(projectId);
        deletePreview(preview.previewId);
        sendJson(response, 200, { ok: true, project: await getProjectModel(projectId) });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'repair-preview') {
        const projectId = segments[2];
        const existing = store.getProject(projectId);
        if (!existing) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        const body = await parseBody(request);
        const candidatePath = body.projectPath ? resolve(String(body.projectPath)) : existing.projectPath;
        const incoming = await inspectPath(candidatePath);
        const preview = createPreviewPayload({
          action: 'repair-project',
          installId: projectId,
          target: 'project',
          targetKey: `project:${projectId}`,
          occupiedBy: existing.projectPath,
          suggestedDecision: 'repair_project_path',
          currentLocalSummary: {
            projectId: existing.projectId,
            displayName: existing.displayName,
            projectPath: existing.projectPath,
            healthState: existing.healthState,
          },
          incomingSummary: {
            projectId: existing.projectId,
            displayName: existing.displayName,
            projectPath: incoming.normalizedPath,
            healthState: incoming.healthState,
            issues: incoming.issues,
          },
          consequenceSummary: `Desktop will update ${existing.displayName} to ${incoming.normalizedPath} and refresh local validation.`,
        });
        sendJson(response, 200, { ok: true, preview });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'repair') {
        const projectId = segments[2];
        const body = await parseBody(request);
        const preview = getPreview(body.previewId);
        const confirmation = validatePreviewConfirmation({ body, preview, action: 'repair-project', targetKey: `project:${projectId}` });
        if (!confirmation.ok) {
          sendJson(response, 409, { ok: false, reason: confirmation.reason });
          return;
        }
        const existing = store.getProject(projectId);
        if (!existing) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        store.saveProject({
          projectId,
          displayName: existing.displayName,
          projectPath: preview.incomingSummary.projectPath,
          healthState: preview.incomingSummary.healthState,
          skillsDirectory: existing.skillsDirectory,
        });
        deletePreview(preview.previewId);
        sendJson(response, 200, { ok: true, project: await getProjectModel(projectId) });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'skills' && segments[5] === 'bind-preview') {
        const projectId = segments[2];
        const skillId = segments[4];
        const project = await getProjectModel(projectId);
        if (!project) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        const body = await parseBody(request);
        const skillsDirectory = resolve(String(body.skillsDirectory ?? project.skillsDirectory ?? resolve(project.projectPath, 'skills')));
        const currentBinding = store.getSkillTargetBinding({ targetType: 'project', targetId: projectId, skillId });
        const preview = createPreviewPayload({
          action: 'bind-project-skill',
          targetType: 'project',
          targetId: projectId,
          skillId,
          currentSummary: currentBinding
            ? {
                packageId: currentBinding.packageId,
                version: currentBinding.version,
                enabled: currentBinding.enabled,
                skillsDirectory: project.skillsDirectory,
              }
            : {
                packageId: null,
                version: null,
                enabled: false,
                skillsDirectory: project.skillsDirectory,
              },
          incomingSummary: {
            packageId: String(body.packageId),
            version: String(body.version),
            enabled: body.enabled ?? true,
            skillsDirectory,
          },
          currentSkillsDirectory: project.skillsDirectory,
          incomingSkillsDirectory: skillsDirectory,
          plannedOperations: [
            {
              operation: body.enabled === false ? 'remove' : 'link',
              targetPath: resolve(skillsDirectory, skillId),
              fallbackMode: 'copy',
            },
          ],
          consequenceSummary: `Desktop will bind ${skillId} to ${project.displayName} and materialize it in ${skillsDirectory}.`,
          blockingIssues: [],
        });
        sendJson(response, 200, { ok: true, preview });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'projects' && segments[3] === 'skills' && segments[5] === 'bind') {
        const projectId = segments[2];
        const skillId = segments[4];
        const body = await parseBody(request);
        const preview = getPreview(body.previewId);
        if (!preview || preview.action !== 'bind-project-skill' || preview.targetType !== 'project' || preview.targetId !== projectId || preview.skillId !== skillId) {
          sendJson(response, 409, { ok: false, reason: 'invalid_preview' });
          return;
        }
        const existing = store.getProject(projectId);
        if (!existing) {
          sendJson(response, 404, { ok: false, reason: 'project_not_found' });
          return;
        }
        store.saveProject({
          ...existing,
          skillsDirectory: preview.incomingSummary.skillsDirectory,
        });
        const binding = store.saveSkillTargetBinding({
          targetType: 'project',
          targetId: projectId,
          skillId,
          packageId: preview.incomingSummary.packageId,
          version: preview.incomingSummary.version,
          enabled: preview.incomingSummary.enabled,
        });
        deletePreview(preview.previewId);
        sendJson(response, 200, { ok: true, binding });
        return;
      }

      if (request.method === 'DELETE' && segments[0] === 'api' && segments[1] === 'projects' && segments.length === 3) {
        const projectId = segments[2];
        store.deleteProject(projectId);
        if (getCurrentProjectState()?.projectId === projectId) {
          setCurrentProject(null);
        }
        sendJson(response, 200, { ok: true, projectId });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/settings') {
        sendJson(response, 200, { ok: true, settings: settingsModel() });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/settings') {
        const body = await parseBody(request);
        persistDesktopSettings({
          ...desktopSettings,
          apiBaseUrl: body.apiBaseUrl ?? desktopSettings.apiBaseUrl,
          scanCommands: body.scanCommands ?? desktopSettings.scanCommands,
          defaultProjectBehavior: body.defaultProjectBehavior ?? desktopSettings.defaultProjectBehavior,
          appearance: body.appearance ?? desktopSettings.appearance,
          updateChannel: body.updateChannel ?? desktopSettings.updateChannel,
        });
        sendJson(response, 200, { ok: true, settings: settingsModel() });
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'previews' && segments[3] === 'cancel') {
        deletePreview(segments[2]);
        sendJson(response, 200, { ok: true, previewId: segments[2] });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/login') {
        const body = await parseBody(request);
        const result = await proxyJson('/api/auth/login', {
          method: 'POST',
          body: {
            username: body.username,
            password: body.password,
            deviceLabel: body.deviceLabel ?? 'Desktop Dev Shell',
          },
          headers: {},
        });
        if (!result.data.ok) {
          sendJson(response, result.status, result.data);
          return;
        }
        sessionState = {
          sessionId: result.data.sessionId,
          user: result.data.user,
        };
        store.saveState('session', sessionState);
        store.saveState('last-user', result.data.user);
        sendJson(response, 200, { ok: true, session: sessionState, user: result.data.user });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/packages/upload') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson('/api/packages/upload', {
          method: 'POST',
          body,
        });
        if (result.data.ok) {
          store.saveCache(`/api/packages/${result.data.report.packageId}/report`, result.data);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'GET' && segments[0] === 'api' && segments[1] === 'packages' && segments[3] === 'report') {
        if (!requireSession(response)) {
          return;
        }
        const result = await proxyJson(url.pathname);
        if (result.data.ok) {
          store.saveCache(url.pathname, result.data);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'GET' && segments[0] === 'api' && segments[1] === 'packages' && segments[3] === 'files' && segments.length >= 5) {
        if (!requireSession(response)) {
          return;
        }
        const result = await proxyBinary(url.pathname);
        response.writeHead(result.status, {
          'content-type': result.contentType,
          'cache-control': 'no-store',
          ...(result.contentDisposition ? { 'content-disposition': result.contentDisposition } : {}),
        });
        response.end(result.body);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/reviews/submit') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson('/api/reviews/submit', {
          method: 'POST',
          body,
        });
        if (result.data.ok) {
          store.saveCache('/api/reviews', result.data.ticket);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'reviews' && segments[3] === 'claim') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson(url.pathname, {
          method: 'POST',
          body,
        });
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'reviews' && segments[3] === 'approve') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson(url.pathname, {
          method: 'POST',
          body,
        });
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && segments[0] === 'api' && segments[1] === 'notifications' && segments[3] === 'read') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson(url.pathname, {
          method: 'POST',
          body,
        });
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/notifications/read-all') {
        if (!requireSession(response)) {
          return;
        }
        const body = await parseBody(request);
        const result = await proxyJson(url.pathname, {
          method: 'POST',
          body,
        });
        sendJson(response, result.status, result.data);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/api/logout') {
        sessionState = null;
        store.deleteState('session');
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/api/events') {
        if (!requireSession(response)) {
          return;
        }
        const upstream = await fetch(`${runtimeApiBaseUrl}/api/notifications/stream?sessionId=${encodeURIComponent(sessionState.sessionId)}`);
        if (!upstream.ok || !upstream.body) {
          sendJson(response, upstream.status, { ok: false, reason: 'sse_proxy_failed' });
          return;
        }
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        });
        const reader = upstream.body.getReader();
        const abort = async () => {
          await reader.cancel();
          response.end();
        };
        request.on('close', abort);
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          response.write(Buffer.from(value));
        }
        response.end();
        return;
      }

      if (request.method === 'GET' && proxyRoutes.has(url.pathname)) {
        if (!requireSession(response)) {
          return;
        }
        const upstreamPath = proxyRoutes.get(url.pathname);
        const query = url.search ? url.search : '';
        const result = await proxyJson(`${upstreamPath}${query}`);
        if (result.data.ok) {
          store.saveCache(url.pathname + query, result.data);
        }
        sendJson(response, result.status, result.data);
        return;
      }

      sendJson(response, 404, { ok: false, reason: 'not_found' });
    } catch (error) {
      sendJson(response, 500, { ok: false, reason: error instanceof Error ? error.message : 'unknown_error' });
    }
  });

  return Object.freeze({ server, store, config: { port, apiBaseUrl: configuredApiBaseUrl, sqlitePath } });
}

export async function startDesktopServer(config = {}) {
  const created = await createDesktopServer(config);
  await new Promise((resolvePromise) => {
    created.server.listen(created.config.port, '127.0.0.1', resolvePromise);
  });
  console.log(JSON.stringify({ ok: true, service: '@enterprise-agent-hub/desktop', port: created.config.port, sqlitePath: created.config.sqlitePath }));
  return created;
}

if (process.argv[1] && resolve(process.argv[1]) === moduleFile) {
  startDesktopServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
