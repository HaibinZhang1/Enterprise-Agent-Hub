// @ts-nocheck
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = dirname(dirname(dirname(packageRoot)));
const migrationScript = `${workspaceRoot}/packages/migrations/src/run-sqlite-migrations.js`;

const SKILLS_DIRECTORY_SOURCES = new Set(['explicit', 'derived', 'derived_pending', 'degraded']);
const TARGET_TYPES = new Set(['tool', 'project']);
const DESIRED_VERSION_INTENTS = new Set(['selected', 'latest', 'pinned', 'manual']);
const ASSOCIATION_STATES = new Set(['resolved', 'unresolved', 'blocked', 'degraded']);
const DECISION_SOURCES = new Set(['manual', 'replay']);
const MATERIALIZATION_MODES = new Set(['none', 'symlink', 'copy']);
const MATERIALIZATION_STATUSES = new Set([
  'pending',
  'materialized',
  'removed',
  'degraded',
  'offline_blocked',
  'access_denied',
  'drifted',
  'error',
]);
const REPORT_STATUSES = new Set(['unknown', 'available', 'offline', 'access_denied', 'not_found', 'error']);

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNullableLiteral(value) {
  return value === null || value === undefined ? 'null' : sqlLiteral(value);
}

function sqlJsonLiteral(value) {
  return value === null || value === undefined ? 'null' : sqlLiteral(JSON.stringify(value));
}

function sqlBoolean(value) {
  return value ? '1' : '0';
}

function parseJsonRows(output) {
  return output ? JSON.parse(output) : [];
}

function parseJsonCell(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return JSON.parse(value);
}

function runSqlite(sqlitePath, sql, json = false) {
  const args = json ? ['-json', sqlitePath, sql] : [sqlitePath, sql];
  const result = spawnSync('sqlite3', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'sqlite3 command failed').trim());
  }
  return result.stdout.trim();
}

function assertEnum(name, value, allowed) {
  if (!allowed.has(value)) {
    throw new Error(`${name} must be one of: ${[...allowed].join(', ')}`);
  }
}

function assertRequired(name, value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new Error(`${name} is required`);
  }
}

function booleanFromRow(value) {
  return Number(value) === 1;
}

function normalizeTargetPathState(input, fallbackSource = 'derived_pending') {
  const source = input.skillsDirectorySource ?? fallbackSource;
  assertEnum('skillsDirectorySource', source, SKILLS_DIRECTORY_SOURCES);
  return {
    skillsDirectory: input.skillsDirectory ?? null,
    skillsDirectorySource: source,
    materializationEnabled: input.materializationEnabled ?? true,
  };
}

function shouldExposeTargetFields(row, includeTarget) {
  return (
    includeTarget ||
    row.skillsDirectory !== null ||
    row.skillsDirectorySource !== 'derived_pending' ||
    !booleanFromRow(row.materializationEnabled)
  );
}

function normalizeTool(row, options = {}) {
  if (!row) {
    return null;
  }
  const tool = {
    toolId: row.toolId,
    displayName: row.displayName,
    installPath: row.installPath,
    healthState: row.healthState,
    updatedAt: row.updatedAt,
  };
  if (shouldExposeTargetFields(row, options.includeTarget === true)) {
    tool.skillsDirectory = row.skillsDirectory;
    tool.skillsDirectorySource = row.skillsDirectorySource;
    tool.materializationEnabled = booleanFromRow(row.materializationEnabled);
  }
  return Object.freeze(tool);
}

function normalizeProject(row, options = {}) {
  if (!row) {
    return null;
  }
  const project = {
    projectId: row.projectId,
    displayName: row.displayName,
    projectPath: row.projectPath,
    healthState: row.healthState,
    updatedAt: row.updatedAt,
  };
  if (shouldExposeTargetFields(row, options.includeTarget === true)) {
    project.skillsDirectory = row.skillsDirectory;
    project.skillsDirectorySource = row.skillsDirectorySource;
    project.materializationEnabled = booleanFromRow(row.materializationEnabled);
  }
  return Object.freeze(project);
}

function normalizeAssociation(row) {
  if (!row) {
    return null;
  }
  return Object.freeze({
    associationId: row.associationId,
    toolId: row.toolId,
    projectId: row.projectId,
    searchRoots: Object.freeze(parseJsonCell(row.searchRoots, [])),
    enabled: booleanFromRow(row.enabled),
    conflictState: row.conflictState,
    manualVersionSummary: parseJsonCell(row.manualVersionSummary, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function normalizeBinding(row) {
  if (!row) {
    return null;
  }
  return Object.freeze({
    bindingId: row.bindingId,
    targetType: row.targetType,
    targetId: row.targetId,
    skillId: row.skillId,
    packageId: row.packageId,
    version: row.version,
    enabled: booleanFromRow(row.enabled),
    desiredVersionIntent: row.desiredVersionIntent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function normalizeVersionOverride(row) {
  if (!row) {
    return null;
  }
  return Object.freeze({
    overrideId: row.overrideId,
    associationId: row.associationId,
    skillId: row.skillId,
    selectedVersion: row.selectedVersion,
    selectedPackageId: row.selectedPackageId,
    decisionSource: row.decisionSource,
    reason: row.reason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function normalizeMaterializationStatus(row) {
  if (!row) {
    return null;
  }
  return Object.freeze({
    statusId: row.statusId,
    targetType: row.targetType,
    targetId: row.targetId,
    skillId: row.skillId,
    packageId: row.packageId,
    version: row.version,
    mode: row.mode,
    status: row.status,
    reportStatus: row.reportStatus,
    driftDetails: parseJsonCell(row.driftDetails, null),
    lastError: row.lastError,
    lastReconciledAt: row.lastReconciledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function defaultAssociationId(toolId, projectId) {
  return `tool:${toolId}:project:${projectId}`;
}

function defaultBindingId(targetType, targetId, skillId) {
  return `${targetType}:${targetId}:skill:${skillId}`;
}

function defaultOverrideId(associationId, skillId) {
  return `${associationId}:skill:${skillId}:override`;
}

function defaultStatusId(targetType, targetId, skillId) {
  return `${targetType}:${targetId}:skill:${skillId}:status`;
}

function sameSelectedPackage(left, right) {
  return left?.version === right?.version && left?.packageId === right?.packageId;
}

function selectedPackageMatches(binding, override) {
  return binding?.version === override?.selectedVersion && binding?.packageId === override?.selectedPackageId;
}

function buildEffectiveResolution({ association, projectBinding, toolBinding, override }) {
  if (!association.enabled) {
    return Object.freeze({ state: 'association_disabled', source: null, binding: null, requiresManualChoice: false });
  }

  const projectEnabled = projectBinding?.enabled === true;
  const toolEnabled = toolBinding?.enabled === true;

  if (projectEnabled && toolEnabled) {
    if (sameSelectedPackage(projectBinding, toolBinding)) {
      return Object.freeze({ state: 'project_wins', source: 'project', binding: projectBinding, requiresManualChoice: false });
    }
    if (override) {
      if (selectedPackageMatches(projectBinding, override)) {
        return Object.freeze({ state: 'manual_override', source: 'project', binding: projectBinding, override, requiresManualChoice: false });
      }
      if (selectedPackageMatches(toolBinding, override)) {
        return Object.freeze({ state: 'manual_override', source: 'tool', binding: toolBinding, override, requiresManualChoice: false });
      }
      return Object.freeze({
        state: 'override_stale',
        source: null,
        binding: null,
        override,
        requiresManualChoice: true,
      });
    }
    return Object.freeze({
      state: 'version_conflict',
      source: null,
      binding: null,
      requiresManualChoice: true,
      candidates: Object.freeze({ project: projectBinding, tool: toolBinding }),
    });
  }

  if (projectEnabled) {
    return Object.freeze({ state: 'project_wins', source: 'project', binding: projectBinding, requiresManualChoice: false });
  }
  if (toolEnabled) {
    return Object.freeze({ state: projectBinding ? 'tool_fallback' : 'tool_only', source: 'tool', binding: toolBinding, requiresManualChoice: false });
  }
  if (projectBinding || toolBinding) {
    return Object.freeze({ state: 'all_bindings_disabled', source: null, binding: null, requiresManualChoice: false });
  }
  return Object.freeze({ state: 'unbound', source: null, binding: null, requiresManualChoice: false });
}

function listFilterClauses(filters) {
  const clauses = [];
  for (const [column, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined) {
      clauses.push(`${column} = ${sqlLiteral(value)}`);
    }
  }
  return clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
}

function ensureColumn(sqlitePath, tableName, columnName, definition) {
  const columns = parseJsonRows(runSqlite(sqlitePath, `pragma table_info(${tableName});`, true));
  if (!columns.some((column) => column.name === columnName)) {
    runSqlite(sqlitePath, `alter table ${tableName} add column ${columnName} ${definition};`);
  }
}

function ensureCompatibilityColumns(sqlitePath) {
  ensureColumn(sqlitePath, 'tool_cache', 'skills_directory', 'text');
  ensureColumn(sqlitePath, 'tool_cache', 'skills_directory_source', "text not null default 'derived_pending'");
  ensureColumn(sqlitePath, 'tool_cache', 'materialization_enabled', 'integer not null default 1');
  ensureColumn(sqlitePath, 'projects', 'skills_directory', 'text');
  ensureColumn(sqlitePath, 'projects', 'skills_directory_source', "text not null default 'derived_pending'");
  ensureColumn(sqlitePath, 'projects', 'materialization_enabled', 'integer not null default 1');
}

function selectToolSql(whereClause) {
  return `
    select
      tool_id as toolId,
      display_name as displayName,
      install_path as installPath,
      skills_directory as skillsDirectory,
      skills_directory_source as skillsDirectorySource,
      materialization_enabled as materializationEnabled,
      health_state as healthState,
      updated_at as updatedAt
    from tool_cache
    ${whereClause}
  `;
}

function selectProjectSql(whereClause) {
  return `
    select
      project_id as projectId,
      display_name as displayName,
      project_path as projectPath,
      skills_directory as skillsDirectory,
      skills_directory_source as skillsDirectorySource,
      materialization_enabled as materializationEnabled,
      health_state as healthState,
      updated_at as updatedAt
    from projects
    ${whereClause}
  `;
}

function selectAssociationSql(whereClause) {
  return `
    select
      association_id as associationId,
      tool_id as toolId,
      project_id as projectId,
      search_roots as searchRoots,
      enabled,
      conflict_state as conflictState,
      manual_version_summary as manualVersionSummary,
      created_at as createdAt,
      updated_at as updatedAt
    from tool_project_associations
    ${whereClause}
  `;
}

function selectBindingSql(whereClause) {
  return `
    select
      binding_id as bindingId,
      target_type as targetType,
      target_id as targetId,
      skill_id as skillId,
      package_id as packageId,
      version,
      enabled,
      desired_version_intent as desiredVersionIntent,
      created_at as createdAt,
      updated_at as updatedAt
    from skill_target_bindings
    ${whereClause}
  `;
}

function selectVersionOverrideSql(whereClause) {
  return `
    select
      override_id as overrideId,
      association_id as associationId,
      skill_id as skillId,
      selected_version as selectedVersion,
      selected_package_id as selectedPackageId,
      decision_source as decisionSource,
      reason,
      created_at as createdAt,
      updated_at as updatedAt
    from skill_target_version_overrides
    ${whereClause}
  `;
}

function selectMaterializationStatusSql(whereClause) {
  return `
    select
      status_id as statusId,
      target_type as targetType,
      target_id as targetId,
      skill_id as skillId,
      package_id as packageId,
      version,
      mode,
      status,
      report_status as reportStatus,
      drift_details as driftDetails,
      last_error as lastError,
      last_reconciled_at as lastReconciledAt,
      created_at as createdAt,
      updated_at as updatedAt
    from skill_materialization_status
    ${whereClause}
  `;
}

export function createLocalSqliteStore(input) {
  const sqlitePath = input.sqlitePath;

  return Object.freeze({
    sqlitePath,

    async init() {
      await mkdir(dirname(sqlitePath), { recursive: true });
      const migrate = spawnSync(process.execPath, [migrationScript], {
        env: { ...process.env, SQLITE_PATH: sqlitePath },
        stdio: 'inherit',
      });
      if (migrate.status !== 0) {
        throw new Error('SQLite migrations failed.');
      }
      ensureCompatibilityColumns(sqlitePath);
    },

    saveState(key, payload) {
      runSqlite(
        sqlitePath,
        `
          insert into client_state (state_key, payload, updated_at)
          values (${sqlLiteral(key)}, ${sqlLiteral(JSON.stringify(payload))}, current_timestamp)
          on conflict(state_key) do update set payload = excluded.payload, updated_at = current_timestamp;
        `,
      );
      return this.getState(key);
    },

    getState(key) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `select payload, updated_at as updatedAt from client_state where state_key = ${sqlLiteral(key)};`,
          true,
        ),
      );
      if (rows.length === 0) {
        return null;
      }
      return Object.freeze({ payload: JSON.parse(rows[0].payload), updatedAt: rows[0].updatedAt });
    },

    deleteState(key) {
      runSqlite(sqlitePath, `delete from client_state where state_key = ${sqlLiteral(key)};`);
    },

    saveCache(key, payload) {
      runSqlite(
        sqlitePath,
        `
          insert into client_cache (cache_key, payload, updated_at)
          values (${sqlLiteral(key)}, ${sqlLiteral(JSON.stringify(payload))}, current_timestamp)
          on conflict(cache_key) do update set payload = excluded.payload, updated_at = current_timestamp;
        `,
      );
      return this.getCache(key);
    },

    getCache(key) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `select payload, updated_at as updatedAt from client_cache where cache_key = ${sqlLiteral(key)};`,
          true,
        ),
      );
      if (rows.length === 0) {
        return null;
      }
      return Object.freeze({ payload: JSON.parse(rows[0].payload), updatedAt: rows[0].updatedAt });
    },

    listCaches() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            'select cache_key as cacheKey, updated_at as updatedAt from client_cache order by updated_at desc;',
            true,
          ),
        ),
      );
    },

    saveTool(tool) {
      const existing = this.getToolTarget(tool.toolId);
      const targetPathState = normalizeTargetPathState(
        {
          skillsDirectory: Object.hasOwn(tool, 'skillsDirectory') ? tool.skillsDirectory : existing?.skillsDirectory,
          skillsDirectorySource: Object.hasOwn(tool, 'skillsDirectorySource')
            ? tool.skillsDirectorySource
            : existing?.skillsDirectorySource,
          materializationEnabled: Object.hasOwn(tool, 'materializationEnabled')
            ? tool.materializationEnabled
            : (existing?.materializationEnabled ?? true),
        },
        existing?.skillsDirectorySource ?? 'derived_pending',
      );
      runSqlite(
        sqlitePath,
        `
          insert into tool_cache (
            tool_id,
            display_name,
            install_path,
            skills_directory,
            skills_directory_source,
            materialization_enabled,
            health_state,
            updated_at
          )
          values (
            ${sqlLiteral(tool.toolId)},
            ${sqlLiteral(tool.displayName)},
            ${sqlLiteral(tool.installPath)},
            ${sqlNullableLiteral(targetPathState.skillsDirectory)},
            ${sqlLiteral(targetPathState.skillsDirectorySource)},
            ${sqlBoolean(targetPathState.materializationEnabled)},
            ${sqlLiteral(tool.healthState)},
            current_timestamp
          )
          on conflict(tool_id) do update set
            display_name = excluded.display_name,
            install_path = excluded.install_path,
            skills_directory = excluded.skills_directory,
            skills_directory_source = excluded.skills_directory_source,
            materialization_enabled = excluded.materialization_enabled,
            health_state = excluded.health_state,
            updated_at = current_timestamp;
        `,
      );
      return this.getTool(tool.toolId);
    },

    getTool(toolId) {
      const rows = parseJsonRows(
        runSqlite(sqlitePath, `${selectToolSql(`where tool_id = ${sqlLiteral(toolId)}`)};`, true),
      );
      return normalizeTool(rows[0] ?? null);
    },

    getToolTarget(toolId) {
      const rows = parseJsonRows(
        runSqlite(sqlitePath, `${selectToolSql(`where tool_id = ${sqlLiteral(toolId)}`)};`, true),
      );
      return normalizeTool(rows[0] ?? null, { includeTarget: true });
    },

    listTools() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectToolSql('')} order by lower(display_name), tool_id;`, true),
        ).map((row) => normalizeTool(row)),
      );
    },

    listToolTargets() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectToolSql('')} order by lower(display_name), tool_id;`, true),
        ).map((row) => normalizeTool(row, { includeTarget: true })),
      );
    },

    configureToolMaterialization(toolId, targetPathState) {
      const existing = this.getToolTarget(toolId);
      if (!existing) {
        return null;
      }
      const normalized = normalizeTargetPathState({
        skillsDirectory: Object.hasOwn(targetPathState, 'skillsDirectory') ? targetPathState.skillsDirectory : existing.skillsDirectory,
        skillsDirectorySource: Object.hasOwn(targetPathState, 'skillsDirectorySource')
          ? targetPathState.skillsDirectorySource
          : existing.skillsDirectorySource,
        materializationEnabled: Object.hasOwn(targetPathState, 'materializationEnabled')
          ? targetPathState.materializationEnabled
          : existing.materializationEnabled,
      });
      runSqlite(
        sqlitePath,
        `
          update tool_cache
          set
            skills_directory = ${sqlNullableLiteral(normalized.skillsDirectory)},
            skills_directory_source = ${sqlLiteral(normalized.skillsDirectorySource)},
            materialization_enabled = ${sqlBoolean(normalized.materializationEnabled)},
            updated_at = current_timestamp
          where tool_id = ${sqlLiteral(toolId)};
        `,
      );
      return this.getToolTarget(toolId);
    },

    deleteTool(toolId) {
      runSqlite(sqlitePath, `delete from tool_cache where tool_id = ${sqlLiteral(toolId)};`);
    },

    saveProject(project) {
      const existing = this.getProjectTarget(project.projectId);
      const targetPathState = normalizeTargetPathState(
        {
          skillsDirectory: Object.hasOwn(project, 'skillsDirectory') ? project.skillsDirectory : existing?.skillsDirectory,
          skillsDirectorySource: Object.hasOwn(project, 'skillsDirectorySource')
            ? project.skillsDirectorySource
            : existing?.skillsDirectorySource,
          materializationEnabled: Object.hasOwn(project, 'materializationEnabled')
            ? project.materializationEnabled
            : (existing?.materializationEnabled ?? true),
        },
        existing?.skillsDirectorySource ?? 'derived_pending',
      );
      runSqlite(
        sqlitePath,
        `
          insert into projects (
            project_id,
            display_name,
            project_path,
            skills_directory,
            skills_directory_source,
            materialization_enabled,
            health_state,
            updated_at
          )
          values (
            ${sqlLiteral(project.projectId)},
            ${sqlLiteral(project.displayName)},
            ${sqlLiteral(project.projectPath)},
            ${sqlNullableLiteral(targetPathState.skillsDirectory)},
            ${sqlLiteral(targetPathState.skillsDirectorySource)},
            ${sqlBoolean(targetPathState.materializationEnabled)},
            ${sqlLiteral(project.healthState)},
            current_timestamp
          )
          on conflict(project_id) do update set
            display_name = excluded.display_name,
            project_path = excluded.project_path,
            skills_directory = excluded.skills_directory,
            skills_directory_source = excluded.skills_directory_source,
            materialization_enabled = excluded.materialization_enabled,
            health_state = excluded.health_state,
            updated_at = current_timestamp;
        `,
      );
      return this.getProject(project.projectId);
    },

    getProject(projectId) {
      const rows = parseJsonRows(
        runSqlite(sqlitePath, `${selectProjectSql(`where project_id = ${sqlLiteral(projectId)}`)};`, true),
      );
      return normalizeProject(rows[0] ?? null);
    },

    getProjectTarget(projectId) {
      const rows = parseJsonRows(
        runSqlite(sqlitePath, `${selectProjectSql(`where project_id = ${sqlLiteral(projectId)}`)};`, true),
      );
      return normalizeProject(rows[0] ?? null, { includeTarget: true });
    },

    listProjects() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectProjectSql('')} order by lower(display_name), project_id;`, true),
        ).map((row) => normalizeProject(row)),
      );
    },

    listProjectTargets() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectProjectSql('')} order by lower(display_name), project_id;`, true),
        ).map((row) => normalizeProject(row, { includeTarget: true })),
      );
    },

    configureProjectMaterialization(projectId, targetPathState) {
      const existing = this.getProjectTarget(projectId);
      if (!existing) {
        return null;
      }
      const normalized = normalizeTargetPathState({
        skillsDirectory: Object.hasOwn(targetPathState, 'skillsDirectory') ? targetPathState.skillsDirectory : existing.skillsDirectory,
        skillsDirectorySource: Object.hasOwn(targetPathState, 'skillsDirectorySource')
          ? targetPathState.skillsDirectorySource
          : existing.skillsDirectorySource,
        materializationEnabled: Object.hasOwn(targetPathState, 'materializationEnabled')
          ? targetPathState.materializationEnabled
          : existing.materializationEnabled,
      });
      runSqlite(
        sqlitePath,
        `
          update projects
          set
            skills_directory = ${sqlNullableLiteral(normalized.skillsDirectory)},
            skills_directory_source = ${sqlLiteral(normalized.skillsDirectorySource)},
            materialization_enabled = ${sqlBoolean(normalized.materializationEnabled)},
            updated_at = current_timestamp
          where project_id = ${sqlLiteral(projectId)};
        `,
      );
      return this.getProjectTarget(projectId);
    },

    deleteProject(projectId) {
      runSqlite(sqlitePath, `delete from projects where project_id = ${sqlLiteral(projectId)};`);
    },

    saveToolProjectAssociation(association) {
      assertRequired('toolId', association.toolId);
      assertRequired('projectId', association.projectId);
      const associationId = association.associationId ?? defaultAssociationId(association.toolId, association.projectId);
      const enabled = association.enabled ?? true;
      const conflictState = association.conflictState ?? 'resolved';
      assertEnum('conflictState', conflictState, ASSOCIATION_STATES);
      runSqlite(
        sqlitePath,
        `
          insert into tool_project_associations (
            association_id,
            tool_id,
            project_id,
            search_roots,
            enabled,
            conflict_state,
            manual_version_summary,
            updated_at
          )
          values (
            ${sqlLiteral(associationId)},
            ${sqlLiteral(association.toolId)},
            ${sqlLiteral(association.projectId)},
            ${sqlLiteral(JSON.stringify(association.searchRoots ?? []))},
            ${sqlBoolean(enabled)},
            ${sqlLiteral(conflictState)},
            ${sqlJsonLiteral(association.manualVersionSummary ?? null)},
            current_timestamp
          )
          on conflict(tool_id, project_id) do update set
            association_id = excluded.association_id,
            search_roots = excluded.search_roots,
            enabled = excluded.enabled,
            conflict_state = excluded.conflict_state,
            manual_version_summary = excluded.manual_version_summary,
            updated_at = current_timestamp;
        `,
      );
      return this.getToolProjectAssociation(associationId);
    },

    getToolProjectAssociation(associationId) {
      const rows = parseJsonRows(
        runSqlite(sqlitePath, `${selectAssociationSql(`where association_id = ${sqlLiteral(associationId)}`)};`, true),
      );
      return normalizeAssociation(rows[0] ?? null);
    },

    findToolProjectAssociation(toolId, projectId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `${selectAssociationSql(`where tool_id = ${sqlLiteral(toolId)} and project_id = ${sqlLiteral(projectId)}`)};`,
          true,
        ),
      );
      return normalizeAssociation(rows[0] ?? null);
    },

    listToolProjectAssociations(filters = {}) {
      const whereClause = listFilterClauses({ tool_id: filters.toolId, project_id: filters.projectId });
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectAssociationSql(whereClause)} order by tool_id, project_id;`, true),
        ).map((row) => normalizeAssociation(row)),
      );
    },

    deleteToolProjectAssociation(associationId) {
      runSqlite(sqlitePath, `delete from tool_project_associations where association_id = ${sqlLiteral(associationId)};`);
    },

    saveSkillTargetBinding(binding) {
      assertRequired('targetType', binding.targetType);
      assertRequired('targetId', binding.targetId);
      assertRequired('skillId', binding.skillId);
      assertRequired('packageId', binding.packageId);
      assertRequired('version', binding.version);
      assertEnum('targetType', binding.targetType, TARGET_TYPES);
      const desiredVersionIntent = binding.desiredVersionIntent ?? 'selected';
      assertEnum('desiredVersionIntent', desiredVersionIntent, DESIRED_VERSION_INTENTS);
      const bindingId = binding.bindingId ?? defaultBindingId(binding.targetType, binding.targetId, binding.skillId);
      runSqlite(
        sqlitePath,
        `
          insert into skill_target_bindings (
            binding_id,
            target_type,
            target_id,
            skill_id,
            package_id,
            version,
            enabled,
            desired_version_intent,
            updated_at
          )
          values (
            ${sqlLiteral(bindingId)},
            ${sqlLiteral(binding.targetType)},
            ${sqlLiteral(binding.targetId)},
            ${sqlLiteral(binding.skillId)},
            ${sqlLiteral(binding.packageId)},
            ${sqlLiteral(binding.version)},
            ${sqlBoolean(binding.enabled ?? true)},
            ${sqlLiteral(desiredVersionIntent)},
            current_timestamp
          )
          on conflict(target_type, target_id, skill_id) do update set
            binding_id = excluded.binding_id,
            package_id = excluded.package_id,
            version = excluded.version,
            enabled = excluded.enabled,
            desired_version_intent = excluded.desired_version_intent,
            updated_at = current_timestamp;
        `,
      );
      return this.getSkillTargetBinding(binding.targetType, binding.targetId, binding.skillId);
    },

    getSkillTargetBinding(targetType, targetId, skillId) {
      assertEnum('targetType', targetType, TARGET_TYPES);
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `${selectBindingSql(`where target_type = ${sqlLiteral(targetType)} and target_id = ${sqlLiteral(targetId)} and skill_id = ${sqlLiteral(skillId)}`)};`,
          true,
        ),
      );
      return normalizeBinding(rows[0] ?? null);
    },

    listSkillTargetBindings(filters = {}) {
      if (filters.targetType !== undefined) {
        assertEnum('targetType', filters.targetType, TARGET_TYPES);
      }
      const whereClause = listFilterClauses({
        target_type: filters.targetType,
        target_id: filters.targetId,
        skill_id: filters.skillId,
      });
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectBindingSql(whereClause)} order by target_type, target_id, skill_id;`, true),
        ).map((row) => normalizeBinding(row)),
      );
    },

    deleteSkillTargetBinding(targetType, targetId, skillId) {
      assertEnum('targetType', targetType, TARGET_TYPES);
      runSqlite(
        sqlitePath,
        `
          delete from skill_target_bindings
          where target_type = ${sqlLiteral(targetType)}
            and target_id = ${sqlLiteral(targetId)}
            and skill_id = ${sqlLiteral(skillId)};
        `,
      );
    },

    saveSkillTargetVersionOverride(override) {
      assertRequired('associationId', override.associationId);
      assertRequired('skillId', override.skillId);
      assertRequired('selectedVersion', override.selectedVersion);
      assertRequired('selectedPackageId', override.selectedPackageId);
      const decisionSource = override.decisionSource ?? 'manual';
      assertEnum('decisionSource', decisionSource, DECISION_SOURCES);
      const overrideId = override.overrideId ?? defaultOverrideId(override.associationId, override.skillId);
      runSqlite(
        sqlitePath,
        `
          insert into skill_target_version_overrides (
            override_id,
            association_id,
            skill_id,
            selected_version,
            selected_package_id,
            decision_source,
            reason,
            updated_at
          )
          values (
            ${sqlLiteral(overrideId)},
            ${sqlLiteral(override.associationId)},
            ${sqlLiteral(override.skillId)},
            ${sqlLiteral(override.selectedVersion)},
            ${sqlLiteral(override.selectedPackageId)},
            ${sqlLiteral(decisionSource)},
            ${sqlNullableLiteral(override.reason)},
            current_timestamp
          )
          on conflict(association_id, skill_id) do update set
            override_id = excluded.override_id,
            selected_version = excluded.selected_version,
            selected_package_id = excluded.selected_package_id,
            decision_source = excluded.decision_source,
            reason = excluded.reason,
            updated_at = current_timestamp;
        `,
      );
      return this.getSkillTargetVersionOverride(override.associationId, override.skillId);
    },

    getSkillTargetVersionOverride(associationId, skillId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `${selectVersionOverrideSql(`where association_id = ${sqlLiteral(associationId)} and skill_id = ${sqlLiteral(skillId)}`)};`,
          true,
        ),
      );
      return normalizeVersionOverride(rows[0] ?? null);
    },

    listSkillTargetVersionOverrides(filters = {}) {
      const whereClause = listFilterClauses({ association_id: filters.associationId, skill_id: filters.skillId });
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectVersionOverrideSql(whereClause)} order by association_id, skill_id;`, true),
        ).map((row) => normalizeVersionOverride(row)),
      );
    },

    deleteSkillTargetVersionOverride(associationId, skillId) {
      runSqlite(
        sqlitePath,
        `
          delete from skill_target_version_overrides
          where association_id = ${sqlLiteral(associationId)}
            and skill_id = ${sqlLiteral(skillId)};
        `,
      );
    },

    saveSkillMaterializationStatus(status) {
      assertRequired('targetType', status.targetType);
      assertRequired('targetId', status.targetId);
      assertRequired('skillId', status.skillId);
      assertRequired('status', status.status);
      assertEnum('targetType', status.targetType, TARGET_TYPES);
      const mode = status.mode ?? 'none';
      const reportStatus = status.reportStatus ?? 'unknown';
      assertEnum('mode', mode, MATERIALIZATION_MODES);
      assertEnum('status', status.status, MATERIALIZATION_STATUSES);
      assertEnum('reportStatus', reportStatus, REPORT_STATUSES);
      const statusId = status.statusId ?? defaultStatusId(status.targetType, status.targetId, status.skillId);
      runSqlite(
        sqlitePath,
        `
          insert into skill_materialization_status (
            status_id,
            target_type,
            target_id,
            skill_id,
            package_id,
            version,
            mode,
            status,
            report_status,
            drift_details,
            last_error,
            last_reconciled_at,
            updated_at
          )
          values (
            ${sqlLiteral(statusId)},
            ${sqlLiteral(status.targetType)},
            ${sqlLiteral(status.targetId)},
            ${sqlLiteral(status.skillId)},
            ${sqlNullableLiteral(status.packageId)},
            ${sqlNullableLiteral(status.version)},
            ${sqlLiteral(mode)},
            ${sqlLiteral(status.status)},
            ${sqlLiteral(reportStatus)},
            ${sqlJsonLiteral(status.driftDetails ?? null)},
            ${sqlNullableLiteral(status.lastError)},
            ${sqlNullableLiteral(status.lastReconciledAt)},
            current_timestamp
          )
          on conflict(target_type, target_id, skill_id) do update set
            status_id = excluded.status_id,
            package_id = excluded.package_id,
            version = excluded.version,
            mode = excluded.mode,
            status = excluded.status,
            report_status = excluded.report_status,
            drift_details = excluded.drift_details,
            last_error = excluded.last_error,
            last_reconciled_at = excluded.last_reconciled_at,
            updated_at = current_timestamp;
        `,
      );
      return this.getSkillMaterializationStatus(status.targetType, status.targetId, status.skillId);
    },

    getSkillMaterializationStatus(targetType, targetId, skillId) {
      assertEnum('targetType', targetType, TARGET_TYPES);
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `${selectMaterializationStatusSql(`where target_type = ${sqlLiteral(targetType)} and target_id = ${sqlLiteral(targetId)} and skill_id = ${sqlLiteral(skillId)}`)};`,
          true,
        ),
      );
      return normalizeMaterializationStatus(rows[0] ?? null);
    },

    listSkillMaterializationStatuses(filters = {}) {
      if (filters.targetType !== undefined) {
        assertEnum('targetType', filters.targetType, TARGET_TYPES);
      }
      const whereClause = listFilterClauses({
        target_type: filters.targetType,
        target_id: filters.targetId,
        skill_id: filters.skillId,
        status: filters.status,
      });
      return Object.freeze(
        parseJsonRows(
          runSqlite(sqlitePath, `${selectMaterializationStatusSql(whereClause)} order by target_type, target_id, skill_id;`, true),
        ).map((row) => normalizeMaterializationStatus(row)),
      );
    },

    deleteSkillMaterializationStatus(targetType, targetId, skillId) {
      assertEnum('targetType', targetType, TARGET_TYPES);
      runSqlite(
        sqlitePath,
        `
          delete from skill_materialization_status
          where target_type = ${sqlLiteral(targetType)}
            and target_id = ${sqlLiteral(targetId)}
            and skill_id = ${sqlLiteral(skillId)};
        `,
      );
    },

    resolveEffectiveSkillForAssociation(input) {
      const association = input.associationId
        ? this.getToolProjectAssociation(input.associationId)
        : this.findToolProjectAssociation(input.toolId, input.projectId);
      if (!association) {
        return null;
      }
      assertRequired('skillId', input.skillId);
      const projectBinding = this.getSkillTargetBinding('project', association.projectId, input.skillId);
      const toolBinding = this.getSkillTargetBinding('tool', association.toolId, input.skillId);
      const override = this.getSkillTargetVersionOverride(association.associationId, input.skillId);
      return Object.freeze({
        association,
        skillId: input.skillId,
        searchRoots: association.searchRoots,
        projectBinding,
        toolBinding,
        override,
        resolution: buildEffectiveResolution({ association, projectBinding, toolBinding, override }),
      });
    },

    listEffectiveSkillResolutions(associationId) {
      const association = this.getToolProjectAssociation(associationId);
      if (!association) {
        return Object.freeze([]);
      }
      const skillIds = new Set([
        ...this.listSkillTargetBindings({ targetType: 'project', targetId: association.projectId }).map((binding) => binding.skillId),
        ...this.listSkillTargetBindings({ targetType: 'tool', targetId: association.toolId }).map((binding) => binding.skillId),
        ...this.listSkillTargetVersionOverrides({ associationId }).map((override) => override.skillId),
      ]);
      return Object.freeze(
        [...skillIds].sort().map((skillId) => this.resolveEffectiveSkillForAssociation({ associationId, skillId })),
      );
    },
  });
}
