export const postgresMigrationPlan = Object.freeze({
  engine: 'postgres',
  files: ['postgres/sql/0001_initial_foundation.sql'],
  executionModes: ['dry-run', 'emit', 'psql'],
});

export const sqliteMigrationPlan = Object.freeze({
  engine: 'sqlite',
  files: ['sqlite/sql/0001_local_state_foundation.sql'],
  executionModes: ['dry-run', 'emit', 'sqlite3'],
});
