pub const P1_INITIAL_MIGRATION_NAME: &str = "0001_p1_local_state";
pub const P1_INITIAL_MIGRATION_SQL: &str = include_str!("../../sqlite/migrations/0001_p1_local_state.sql");

pub fn ordered_migrations() -> [(&'static str, &'static str); 1] {
    [(P1_INITIAL_MIGRATION_NAME, P1_INITIAL_MIGRATION_SQL)]
}

#[cfg(test)]
mod tests {
    use super::P1_INITIAL_MIGRATION_SQL;

    #[test]
    fn migration_contains_store_owned_tables() {
        for table in [
            "local_skill_installs",
            "enabled_targets",
            "offline_event_queue",
            "local_notifications",
            "store_metadata",
        ] {
            assert!(P1_INITIAL_MIGRATION_SQL.contains(table), "missing {table}");
        }
        assert!(P1_INITIAL_MIGRATION_SQL.contains("requested_mode"));
        assert!(P1_INITIAL_MIGRATION_SQL.contains("resolved_mode"));
        assert!(P1_INITIAL_MIGRATION_SQL.contains("fallback_reason"));
    }
}
