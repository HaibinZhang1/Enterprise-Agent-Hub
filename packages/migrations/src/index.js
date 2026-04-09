export const postgresMigrationPlan = Object.freeze({
  engine: 'postgres',
  files: [
    'postgres/sql/0001_initial_foundation.sql',
    'postgres/sql/0002_mvp_read_models.sql',
    'postgres/sql/0003_package_artifact_storage.sql',
  ],
  executionModes: ['dry-run', 'emit', 'psql'],
});

export const sqliteMigrationPlan = Object.freeze({
  engine: 'sqlite',
  files: [
    'sqlite/sql/0001_local_state_foundation.sql',
    'sqlite/sql/0002_mvp_client_cache.sql',
  ],
  executionModes: ['dry-run', 'emit', 'sqlite3'],
});
