mod config;
mod detection;
mod distribution;
mod errors;
mod path_validation;
mod transform;

pub use self::config::{
    builtin_adapters, AdapterConfig, AdapterID, DetectionConfig, DetectionMethod, InstallConfig,
    InstallMode, LayoutConfig, Platform, TargetConfig, TransformStrategy,
};
pub use self::detection::{
    detect_adapter, expand_windows_user_profile, AdapterStatus, DetectionResult,
};
pub use self::distribution::{
    disable_managed_target, enable_artifact, enable_artifact_with_options, is_managed_target,
    DistributionOptions, DistributionOutcome, MANAGED_MARKER_FILE,
};
pub use self::errors::{AdapterError, AdapterResult};
pub use self::path_validation::{
    ensure_target_root, reject_ambiguous_path, validate_target_path, PathValidation,
};
pub use self::transform::{transform_skill, validate_skill_id, DerivedArtifact};

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn builtin_adapters_match_p1_contract() {
        let adapters = builtin_adapters();
        let ids: Vec<_> = adapters
            .iter()
            .map(|adapter| adapter.tool_id.as_str())
            .collect();
        assert_eq!(
            ids,
            vec![
                "codex",
                "claude",
                "cursor",
                "windsurf",
                "opencode",
                "custom_directory"
            ]
        );
        for adapter in adapters {
            assert!(adapter
                .install
                .supported_modes
                .contains(&InstallMode::Symlink));
            assert!(adapter.install.supported_modes.contains(&InstallMode::Copy));
            assert_eq!(adapter.install.default_mode, InstallMode::Symlink);
            assert_eq!(adapter.install.fallback_mode, InstallMode::Copy);
            assert_eq!(
                adapter.target_name_for_skill("example-skill"),
                "example-skill"
            );
            assert_eq!(adapter.marker_files, vec!["SKILL.md".to_string()]);
        }
    }

    #[test]
    fn cursor_transform_writes_rule_without_touching_target_dir() {
        let temp = TestTemp::new("cursor-transform");
        let source = temp.path.join("store/example-skill/1.0.0");
        fs::create_dir_all(source.join("assets")).unwrap();
        fs::write(
            source.join("SKILL.md"),
            "# Example Skill\n\nUse this skill.\n",
        )
        .unwrap();
        fs::write(source.join("assets/readme.txt"), "asset").unwrap();

        let artifact = transform_skill(
            &source,
            temp.path.join("derived"),
            "example-skill",
            "1.0.0",
            TransformStrategy::CursorRule,
        )
        .unwrap();

        assert_eq!(artifact.strategy, TransformStrategy::CursorRule);
        assert!(artifact.entry_file.ends_with("example-skill.mdc"));
        let text = fs::read_to_string(&artifact.entry_file).unwrap();
        assert!(text.contains("description: Example Skill"));
        assert!(text.contains("# Example Skill"));
        assert!(artifact.artifact_path.join(MANAGED_MARKER_FILE).is_file());
        assert!(!temp.path.join("target/example-skill").exists());
    }

    #[test]
    fn symlink_failure_falls_back_to_managed_copy_with_reason() {
        let temp = TestTemp::new("copy-fallback");
        let artifact = temp.path.join("artifact");
        fs::create_dir_all(&artifact).unwrap();
        fs::write(artifact.join("SKILL.md"), "# Example Skill\n").unwrap();
        fs::write(artifact.join(MANAGED_MARKER_FILE), "{}").unwrap();
        let target_root = temp.path.join("target");

        let outcome = enable_artifact_with_options(
            &artifact,
            &target_root,
            "example-skill",
            InstallMode::Symlink,
            DistributionOptions {
                allow_overwrite_target: true,
                simulated_symlink_failure: Some("symlink_permission_denied".to_string()),
            },
        )
        .unwrap();

        assert_eq!(outcome.requested_mode, InstallMode::Symlink);
        assert_eq!(outcome.resolved_mode, InstallMode::Copy);
        assert_eq!(
            outcome.fallback_reason.as_deref(),
            Some("symlink_permission_denied")
        );
        assert!(outcome.target_path.join("SKILL.md").is_file());
        assert!(is_managed_target(&outcome.target_path));
    }

    #[test]
    fn disable_refuses_unmanaged_target_and_keeps_central_store() {
        let temp = TestTemp::new("disable-safety");
        let central_store = temp.path.join("central-store/example-skill/1.0.0");
        let target = temp.path.join("target/example-skill");
        fs::create_dir_all(&central_store).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(central_store.join("SKILL.md"), "# Example Skill\n").unwrap();
        fs::write(target.join("manual.txt"), "do not remove").unwrap();

        assert!(matches!(
            disable_managed_target(&target),
            Err(AdapterError::UnmanagedTarget { .. })
        ));
        assert!(central_store.join("SKILL.md").is_file());
        assert!(target.join("manual.txt").is_file());
    }

    struct TestTemp {
        path: PathBuf,
    }

    impl TestTemp {
        fn new(name: &str) -> Self {
            let nonce = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!("eah-{name}-{nonce}"));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestTemp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
