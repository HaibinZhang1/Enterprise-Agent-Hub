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

function sqlNullable(value) {
  return value === null || value === undefined ? 'null' : sqlLiteral(value);
}

function sqlBoolean(value, fallback = true) {
  return value ?? fallback ? '1' : '0';
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
            health_state,
            skills_directory,
            materialization_enabled,
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
            ${sqlNullable(tool.skillsDirectory)},
            ${sqlBoolean(tool.materializationEnabled)},
            current_timestamp
          )
          on conflict(tool_id) do update set
            display_name = excluded.display_name,
            install_path = excluded.install_path,
            skills_directory = excluded.skills_directory,
            skills_directory_source = excluded.skills_directory_source,
            materialization_enabled = excluded.materialization_enabled,
            health_state = excluded.health_state,
            skills_directory = excluded.skills_directory,
            materialization_enabled = excluded.materialization_enabled,
            updated_at = current_timestamp;
        `,
      );
      return this.getTool(tool.toolId);
    },

    getTool(toolId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              tool_id as toolId,
              display_name as displayName,
              install_path as installPath,
              health_state as healthState,
              skills_directory as skillsDirectory,
              materialization_enabled as materializationEnabled,
              updated_at as updatedAt
            from tool_cache
            where tool_id = ${sqlLiteral(toolId)};
          `,
          true,
        ),
      );
      return rows[0] ? Object.freeze({ ...rows[0], materializationEnabled: Boolean(rows[0].materializationEnabled) }) : null;
    },

    listTools() {
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            `
              select
                tool_id as toolId,
                display_name as displayName,
                install_path as installPath,
                health_state as healthState,
                skills_directory as skillsDirectory,
                materialization_enabled as materializationEnabled,
                updated_at as updatedAt
              from tool_cache
              order by lower(display_name), tool_id;
            `,
            true,
          ),
        ).map((row) => Object.freeze({ ...row, materializationEnabled: Boolean(row.materializationEnabled) })),
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
          insert into projects (project_id, display_name, project_path, health_state, skills_directory, updated_at)
          values (
            ${sqlLiteral(project.projectId)},
            ${sqlLiteral(project.displayName)},
            ${sqlLiteral(project.projectPath)},
            ${sqlNullableLiteral(targetPathState.skillsDirectory)},
            ${sqlLiteral(targetPathState.skillsDirectorySource)},
            ${sqlBoolean(targetPathState.materializationEnabled)},
            ${sqlLiteral(project.healthState)},
            ${sqlNullable(project.skillsDirectory)},
            current_timestamp
          )
          on conflict(project_id) do update set
            display_name = excluded.display_name,
            project_path = excluded.project_path,
            skills_directory = excluded.skills_directory,
            skills_directory_source = excluded.skills_directory_source,
            materialization_enabled = excluded.materialization_enabled,
            health_state = excluded.health_state,
            skills_directory = excluded.skills_directory,
            updated_at = current_timestamp;
        `,
      );
      return this.getProject(project.projectId);
    },

    getProject(projectId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              project_id as projectId,
              display_name as displayName,
              project_path as projectPath,
              health_state as healthState,
              skills_directory as skillsDirectory,
              updated_at as updatedAt
            from projects
            where project_id = ${sqlLiteral(projectId)};
          `,
          true,
        ),
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
          runSqlite(
            sqlitePath,
            `
              select
                project_id as projectId,
                display_name as displayName,
                project_path as projectPath,
                health_state as healthState,
                skills_directory as skillsDirectory,
                updated_at as updatedAt
              from projects
              order by lower(display_name), project_id;
            `,
            true,
          ),
        ),
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
      runSqlite(
        sqlitePath,
        `
          insert into tool_project_associations (
            association_id,
            tool_id,
            project_id,
            enabled,
            search_roots,
            conflict_state,
            updated_at
          )
          values (
            ${sqlLiteral(association.associationId)},
            ${sqlLiteral(association.toolId)},
            ${sqlLiteral(association.projectId)},
            ${sqlBoolean(association.enabled)},
            ${sqlLiteral(JSON.stringify(association.searchRoots ?? []))},
            ${sqlLiteral(association.conflictState ?? 'clear')},
            current_timestamp
          )
          on conflict(association_id) do update set
            tool_id = excluded.tool_id,
            project_id = excluded.project_id,
            enabled = excluded.enabled,
            search_roots = excluded.search_roots,
            conflict_state = excluded.conflict_state,
            updated_at = current_timestamp;
        `,
      );
      return this.getToolProjectAssociation(association.associationId);
    },

    getToolProjectAssociation(associationId) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              association_id as associationId,
              tool_id as toolId,
              project_id as projectId,
              enabled,
              search_roots as searchRoots,
              conflict_state as conflictState,
              updated_at as updatedAt
            from tool_project_associations
            where association_id = ${sqlLiteral(associationId)};
          `,
          true,
        ),
      );
      if (!rows[0]) {
        return null;
      }
      return Object.freeze({
        ...rows[0],
        enabled: Boolean(rows[0].enabled),
        searchRoots: JSON.parse(rows[0].searchRoots),
      });
    },

    listToolProjectAssociations(filter = {}) {
      const clauses = [];
      if (filter.toolId) {
        clauses.push(`tool_id = ${sqlLiteral(filter.toolId)}`);
      }
      if (filter.projectId) {
        clauses.push(`project_id = ${sqlLiteral(filter.projectId)}`);
      }
      const where = clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            `
              select
                association_id as associationId,
                tool_id as toolId,
                project_id as projectId,
                enabled,
                search_roots as searchRoots,
                conflict_state as conflictState,
                updated_at as updatedAt
              from tool_project_associations
              ${where}
              order by association_id;
            `,
            true,
          ),
        ).map((row) => Object.freeze({
          ...row,
          enabled: Boolean(row.enabled),
          searchRoots: JSON.parse(row.searchRoots),
        })),
      );
    },

    saveSkillTargetBinding(binding) {
      runSqlite(
        sqlitePath,
        `
          insert into skill_target_bindings (
            target_type,
            target_id,
            skill_id,
            package_id,
            version,
            enabled,
            updated_at
          )
          values (
            ${sqlLiteral(binding.targetType)},
            ${sqlLiteral(binding.targetId)},
            ${sqlLiteral(binding.skillId)},
            ${sqlLiteral(binding.packageId)},
            ${sqlLiteral(binding.version)},
            ${sqlBoolean(binding.enabled)},
            current_timestamp
          )
          on conflict(target_type, target_id, skill_id) do update set
            package_id = excluded.package_id,
            version = excluded.version,
            enabled = excluded.enabled,
            updated_at = current_timestamp;
        `,
      );
      return this.getSkillTargetBinding({
        targetType: binding.targetType,
        targetId: binding.targetId,
        skillId: binding.skillId,
      });
    },

    getSkillTargetBinding(binding) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              target_type as targetType,
              target_id as targetId,
              skill_id as skillId,
              package_id as packageId,
              version,
              enabled,
              updated_at as updatedAt
            from skill_target_bindings
            where target_type = ${sqlLiteral(binding.targetType)}
              and target_id = ${sqlLiteral(binding.targetId)}
              and skill_id = ${sqlLiteral(binding.skillId)};
          `,
          true,
        ),
      );
      return rows[0] ? Object.freeze({ ...rows[0], enabled: Boolean(rows[0].enabled) }) : null;
    },

    listSkillTargetBindings(filter = {}) {
      const clauses = [];
      if (filter.targetType) {
        clauses.push(`target_type = ${sqlLiteral(filter.targetType)}`);
      }
      if (filter.targetId) {
        clauses.push(`target_id = ${sqlLiteral(filter.targetId)}`);
      }
      if (filter.skillId) {
        clauses.push(`skill_id = ${sqlLiteral(filter.skillId)}`);
      }
      const where = clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            `
              select
                target_type as targetType,
                target_id as targetId,
                skill_id as skillId,
                package_id as packageId,
                version,
                enabled,
                updated_at as updatedAt
              from skill_target_bindings
              ${where}
              order by target_type, target_id, skill_id;
            `,
            true,
          ),
        ).map((row) => Object.freeze({ ...row, enabled: Boolean(row.enabled) })),
      );
    },

    saveSkillTargetVersionOverride(override) {
      runSqlite(
        sqlitePath,
        `
          insert into skill_target_version_overrides (
            association_id,
            skill_id,
            selected_version,
            selected_package_id,
            reason,
            updated_at
          )
          values (
            ${sqlLiteral(override.associationId)},
            ${sqlLiteral(override.skillId)},
            ${sqlLiteral(override.selectedVersion)},
            ${sqlLiteral(override.selectedPackageId)},
            ${sqlLiteral(override.reason)},
            current_timestamp
          )
          on conflict(association_id, skill_id) do update set
            selected_version = excluded.selected_version,
            selected_package_id = excluded.selected_package_id,
            reason = excluded.reason,
            updated_at = current_timestamp;
        `,
      );
      return this.getSkillTargetVersionOverride({
        associationId: override.associationId,
        skillId: override.skillId,
      });
    },

    getSkillTargetVersionOverride(override) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              association_id as associationId,
              skill_id as skillId,
              selected_version as selectedVersion,
              selected_package_id as selectedPackageId,
              reason,
              updated_at as updatedAt
            from skill_target_version_overrides
            where association_id = ${sqlLiteral(override.associationId)}
              and skill_id = ${sqlLiteral(override.skillId)};
          `,
          true,
        ),
      );
      return Object.freeze(rows[0] ?? null);
    },

    saveSkillMaterializationStatus(status) {
      runSqlite(
        sqlitePath,
        `
          insert into skill_materialization_status (
            target_type,
            target_id,
            skill_id,
            package_id,
            version,
            mode,
            status,
            target_path,
            source_path,
            last_error,
            updated_at
          )
          values (
            ${sqlLiteral(status.targetType)},
            ${sqlLiteral(status.targetId)},
            ${sqlLiteral(status.skillId)},
            ${sqlLiteral(status.packageId)},
            ${sqlLiteral(status.version)},
            ${sqlLiteral(status.mode)},
            ${sqlLiteral(status.status)},
            ${sqlLiteral(status.targetPath)},
            ${sqlNullable(status.sourcePath)},
            ${sqlNullable(status.lastError)},
            current_timestamp
          )
          on conflict(target_type, target_id, skill_id) do update set
            package_id = excluded.package_id,
            version = excluded.version,
            mode = excluded.mode,
            status = excluded.status,
            target_path = excluded.target_path,
            source_path = excluded.source_path,
            last_error = excluded.last_error,
            updated_at = current_timestamp;
        `,
      );
      return this.getSkillMaterializationStatus({
        targetType: status.targetType,
        targetId: status.targetId,
        skillId: status.skillId,
      });
    },

    getSkillMaterializationStatus(status) {
      const rows = parseJsonRows(
        runSqlite(
          sqlitePath,
          `
            select
              target_type as targetType,
              target_id as targetId,
              skill_id as skillId,
              package_id as packageId,
              version,
              mode,
              status,
              target_path as targetPath,
              source_path as sourcePath,
              last_error as lastError,
              updated_at as updatedAt
            from skill_materialization_status
            where target_type = ${sqlLiteral(status.targetType)}
              and target_id = ${sqlLiteral(status.targetId)}
              and skill_id = ${sqlLiteral(status.skillId)};
          `,
          true,
        ),
      );
      return Object.freeze(rows[0] ?? null);
    },

    listSkillMaterializationStatuses(filter = {}) {
      const clauses = [];
      if (filter.targetType) {
        clauses.push(`target_type = ${sqlLiteral(filter.targetType)}`);
      }
      if (filter.targetId) {
        clauses.push(`target_id = ${sqlLiteral(filter.targetId)}`);
      }
      if (filter.skillId) {
        clauses.push(`skill_id = ${sqlLiteral(filter.skillId)}`);
      }
      const where = clauses.length > 0 ? `where ${clauses.join(' and ')}` : '';
      return Object.freeze(
        parseJsonRows(
          runSqlite(
            sqlitePath,
            `
              select
                target_type as targetType,
                target_id as targetId,
                skill_id as skillId,
                package_id as packageId,
                version,
                mode,
                status,
                target_path as targetPath,
                source_path as sourcePath,
                last_error as lastError,
                updated_at as updatedAt
              from skill_materialization_status
              ${where}
              order by target_type, target_id, skill_id;
            `,
            true,
          ),
        ),
      );
    },

    resolveEffectiveSkillBinding(input) {
      let association = null;
      if (input.associationId) {
        association = this.getToolProjectAssociation(input.associationId);
      } else if (input.toolId && input.projectId) {
        association = this.listToolProjectAssociations({ toolId: input.toolId, projectId: input.projectId })
          .find((entry) => entry.enabled);
        if (!association) {
          return Object.freeze({ status: 'independent_targets', candidates: Object.freeze([]), effectiveBinding: null });
        }
      }
      if (!association || !association.enabled) {
        return Object.freeze({ status: 'independent_targets', candidates: Object.freeze([]), effectiveBinding: null });
      }

      const candidates = this.listSkillTargetBindings({ skillId: input.skillId })
        .filter((binding) => (
          (binding.targetType === 'project' && binding.targetId === association.projectId) ||
          (binding.targetType === 'tool' && binding.targetId === association.toolId)
        ));
      const projectBinding = candidates.find((binding) => binding.targetType === 'project');
      const toolBinding = candidates.find((binding) => binding.targetType === 'tool');
      const enabledCandidates = candidates.filter((binding) => binding.enabled);

      if (projectBinding?.enabled && toolBinding?.enabled && projectBinding.version !== toolBinding.version) {
        const override = this.getSkillTargetVersionOverride({
          associationId: association.associationId,
          skillId: input.skillId,
        });
        if (!override) {
          return Object.freeze({
            status: 'manual_choice_required',
            candidates: Object.freeze(candidates),
            effectiveBinding: null,
          });
        }
        const effectiveBinding = enabledCandidates.find((binding) => (
          binding.version === override.selectedVersion &&
          binding.packageId === override.selectedPackageId
        )) ?? null;
        return Object.freeze({
          status: effectiveBinding ? 'resolved' : 'manual_choice_required',
          candidates: Object.freeze(candidates),
          effectiveBinding,
          override,
        });
      }

      const effectiveBinding = projectBinding?.enabled ? projectBinding : toolBinding?.enabled ? toolBinding : null;
      return Object.freeze({
        status: effectiveBinding ? 'resolved' : 'not_materialized',
        candidates: Object.freeze(candidates),
        effectiveBinding,
      });
    },
  });
}
