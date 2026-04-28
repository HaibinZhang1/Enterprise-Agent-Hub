use serde::Serialize;

use crate::process::background_command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDirectorySelectionPayload {
    pub project_path: String,
}

pub fn pick_project_directory() -> Result<Option<ProjectDirectorySelectionPayload>, String> {
    let project_path = platform_pick_project_directory()?;
    Ok(project_path.map(|project_path| ProjectDirectorySelectionPayload { project_path }))
}

#[cfg(target_os = "macos")]
fn platform_pick_project_directory() -> Result<Option<String>, String> {
    let output = background_command("osascript")
        .args([
            "-e",
            "set selectedFolder to POSIX path of (choose folder with prompt \"选择项目目录\")",
            "-e",
            "return selectedFolder",
        ])
        .output()
        .map_err(|error| format!("launch osascript: {error}"))?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| format!("decode osascript output: {error}"))?;
        return Ok(normalize_selected_path(&stdout));
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if stderr.contains("User canceled") {
        return Ok(None);
    }

    Err(format!("pick project directory failed: {}", stderr.trim()))
}

#[cfg(target_os = "windows")]
fn platform_pick_project_directory() -> Result<Option<String>, String> {
    const SCRIPT: &str = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '选择项目目录'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.SelectedPath)
}
"#;

    let output = background_command("powershell")
        .args(["-NoProfile", "-STA", "-Command", SCRIPT])
        .output()
        .map_err(|error| format!("launch powershell: {error}"))?;

    if output.status.success() {
        let stdout = String::from_utf8(output.stdout)
            .map_err(|error| format!("decode powershell output: {error}"))?;
        return Ok(normalize_selected_path(&stdout));
    }

    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Err(format!("pick project directory failed: {}", stderr.trim()))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn platform_pick_project_directory() -> Result<Option<String>, String> {
    Err("pick project directory is only supported on macOS and Windows".to_string())
}

fn normalize_selected_path(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let normalized = trimmed
        .trim_end_matches('/')
        .trim_end_matches('\\')
        .trim()
        .to_string();

    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_selected_path;

    #[test]
    fn normalizes_selected_paths() {
        assert_eq!(
            normalize_selected_path("/Users/demo/Project/\n"),
            Some("/Users/demo/Project".to_string())
        );
        assert_eq!(
            normalize_selected_path("C:\\workspace\\demo\\\r\n"),
            Some("C:\\workspace\\demo".to_string())
        );
        assert_eq!(normalize_selected_path("   "), None);
    }
}
