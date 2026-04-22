use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::process::background_command;
use crate::store::hash::sha256_hex;

const CLIENT_UPDATES_DIR: &str = "EnterpriseAgentHub/client-updates";
const CLIENT_UPDATE_METADATA_FILE: &str = "metadata.json";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientAppVersionPayload {
    pub current_version: String,
    pub platform: String,
    pub arch: String,
    pub windows_x64_supported: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateDownloadPayload {
    #[serde(rename = "releaseID")]
    pub release_id: String,
    pub version: String,
    #[serde(rename = "packageURL")]
    pub package_url: String,
    #[serde(rename = "packageHash")]
    pub package_hash: String,
    #[serde(rename = "packageSize")]
    pub package_size: u64,
    pub file_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateDownloadResultPayload {
    #[serde(rename = "releaseID")]
    pub release_id: String,
    pub version: String,
    pub file_name: String,
    pub staged_file_path: String,
    pub metadata_path: String,
    pub package_hash: String,
    pub package_size: u64,
    pub downloaded_at: String,
    pub hash_verified: bool,
    pub signature_status: String,
    pub ready_to_install: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateVerifyPayload {
    pub metadata_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateVerificationPayload {
    #[serde(rename = "releaseID")]
    pub release_id: String,
    pub version: String,
    pub staged_file_path: String,
    pub metadata_path: String,
    pub expected_hash: String,
    pub actual_hash: String,
    pub verified_at: String,
    pub hash_verified: bool,
    pub signature_status: String,
    pub signature_details: Option<String>,
    pub ready_to_install: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateLaunchPayload {
    pub metadata_path: String,
    pub user_confirmed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientUpdateLaunchResultPayload {
    #[serde(rename = "releaseID")]
    pub release_id: String,
    pub version: String,
    pub staged_file_path: String,
    pub metadata_path: String,
    pub launched_at: String,
    pub ready_to_install: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientUpdateMetadata {
    #[serde(rename = "releaseID")]
    release_id: String,
    version: String,
    file_name: String,
    staged_file_path: String,
    #[serde(rename = "packageURL")]
    package_url: String,
    #[serde(rename = "packageHash")]
    package_hash: String,
    #[serde(rename = "packageSize")]
    package_size: u64,
    downloaded_at: String,
    actual_hash: String,
    hash_verified: bool,
    verification_state: String,
    last_verified_at: Option<String>,
    signature_status: String,
    signature_details: Option<String>,
}

impl ClientUpdateMetadata {
    fn ready_to_install(&self) -> bool {
        self.hash_verified
            && self.verification_state == "verified"
            && matches!(
                self.signature_status.as_str(),
                "valid" | "skipped_non_windows"
            )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct InstallerLaunchPlan {
    program: String,
    args: Vec<String>,
}

pub fn get_client_app_version() -> ClientAppVersionPayload {
    ClientAppVersionPayload {
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        windows_x64_supported: cfg!(target_os = "windows") && cfg!(target_arch = "x86_64"),
    }
}

pub fn download_client_update(
    app: &AppHandle,
    input: ClientUpdateDownloadPayload,
) -> Result<ClientUpdateDownloadResultPayload, String> {
    let root = client_updates_root(app)?;
    download_client_update_to_root(&root, input)
}

pub fn verify_client_update(
    input: ClientUpdateVerifyPayload,
) -> Result<ClientUpdateVerificationPayload, String> {
    verify_client_update_from_metadata(Path::new(&input.metadata_path))
}

pub fn launch_client_installer(
    input: ClientUpdateLaunchPayload,
) -> Result<ClientUpdateLaunchResultPayload, String> {
    launch_client_installer_with(Path::new(&input.metadata_path), input.user_confirmed, |plan| {
        execute_launch(plan)
    })
}

fn client_updates_root(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("resolve app data dir: {error}"))?;
    let root = app_data_dir.join(CLIENT_UPDATES_DIR);
    fs::create_dir_all(&root)
        .map_err(|error| format!("create client update cache root {}: {error}", root.display()))?;
    Ok(root)
}

fn download_client_update_to_root(
    root: &Path,
    input: ClientUpdateDownloadPayload,
) -> Result<ClientUpdateDownloadResultPayload, String> {
    validate_download_request(&input)?;
    let release_dir = staging_dir(root, &input.release_id, &input.version);
    fs::create_dir_all(&release_dir)
        .map_err(|error| format!("create client update staging dir {}: {error}", release_dir.display()))?;

    let file_name = resolve_file_name(input.file_name.as_deref(), &input.package_url, &input.version);
    let staged_file_path = release_dir.join(&file_name);
    let metadata_path = release_dir.join(CLIENT_UPDATE_METADATA_FILE);

    let response = Client::new()
        .get(&input.package_url)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| format!("download client update package: {error}"))?;

    let bytes = response
        .bytes()
        .map_err(|error| format!("read client update package bytes: {error}"))?;
    if bytes.len() as u64 != input.package_size {
        return Err(format!(
            "downloaded installer size mismatch: expected {}, actual {}",
            input.package_size,
            bytes.len()
        ));
    }

    let actual_hash = format!("sha256:{}", sha256_hex(bytes.as_ref()));
    if !hashes_match(&input.package_hash, &actual_hash) {
        return Err(format!(
            "downloaded installer hash mismatch: expected {}, actual {}",
            input.package_hash, actual_hash
        ));
    }

    fs::write(&staged_file_path, bytes.as_ref()).map_err(|error| {
        format!(
            "write staged installer {}: {error}",
            staged_file_path.display()
        )
    })?;

    let metadata = ClientUpdateMetadata {
        release_id: input.release_id,
        version: input.version,
        file_name,
        staged_file_path: staged_file_path.to_string_lossy().to_string(),
        package_url: input.package_url,
        package_hash: input.package_hash,
        package_size: input.package_size,
        downloaded_at: now_stamp("downloaded"),
        actual_hash,
        hash_verified: true,
        verification_state: "downloaded".to_string(),
        last_verified_at: None,
        signature_status: "pending".to_string(),
        signature_details: None,
    };
    write_metadata(&metadata_path, &metadata)?;
    Ok(build_download_result(&metadata, &metadata_path))
}

fn verify_client_update_from_metadata(
    metadata_path: &Path,
) -> Result<ClientUpdateVerificationPayload, String> {
    let mut metadata = read_metadata(metadata_path)?;
    let staged_file_path = PathBuf::from(&metadata.staged_file_path);
    if !staged_file_path.is_file() {
        return Err(format!(
            "staged installer does not exist: {}",
            staged_file_path.display()
        ));
    }

    let bytes = fs::read(&staged_file_path).map_err(|error| {
        format!(
            "read staged installer {}: {error}",
            staged_file_path.display()
        )
    })?;
    let actual_hash = format!("sha256:{}", sha256_hex(&bytes));
    let hash_verified = hashes_match(&metadata.package_hash, &actual_hash);
    let (signature_status, signature_details) = inspect_signature(&staged_file_path);
    let verified_at = now_stamp("verified");

    metadata.actual_hash = actual_hash.clone();
    metadata.hash_verified = hash_verified;
    metadata.verification_state = if hash_verified {
        "verified".to_string()
    } else {
        "failed".to_string()
    };
    metadata.last_verified_at = Some(verified_at.clone());
    metadata.signature_status = signature_status.clone();
    metadata.signature_details = signature_details.clone();
    write_metadata(metadata_path, &metadata)?;
    let ready_to_install = metadata.ready_to_install();

    Ok(ClientUpdateVerificationPayload {
        release_id: metadata.release_id,
        version: metadata.version,
        staged_file_path: metadata.staged_file_path,
        metadata_path: metadata_path.to_string_lossy().to_string(),
        expected_hash: metadata.package_hash.clone(),
        actual_hash,
        verified_at,
        hash_verified,
        signature_status,
        signature_details,
        ready_to_install,
    })
}

fn launch_client_installer_with<F>(
    metadata_path: &Path,
    user_confirmed: bool,
    executor: F,
) -> Result<ClientUpdateLaunchResultPayload, String>
where
    F: FnOnce(&InstallerLaunchPlan) -> Result<(), String>,
{
    let metadata = read_metadata(metadata_path)?;
    if !user_confirmed {
        return Err("installer launch requires explicit user confirmation".to_string());
    }
    if !metadata.ready_to_install() {
        return Err(format!(
            "staged installer is not verified and ready to install: {}",
            metadata.staged_file_path
        ));
    }
    let plan = prepare_installer_launch(Path::new(&metadata.staged_file_path), user_confirmed)?;
    executor(&plan)?;
    Ok(ClientUpdateLaunchResultPayload {
        release_id: metadata.release_id,
        version: metadata.version,
        staged_file_path: metadata.staged_file_path,
        metadata_path: metadata_path.to_string_lossy().to_string(),
        launched_at: now_stamp("launched"),
        ready_to_install: true,
    })
}

fn prepare_installer_launch(
    installer_path: &Path,
    user_confirmed: bool,
) -> Result<InstallerLaunchPlan, String> {
    if !user_confirmed {
        return Err("installer launch requires explicit user confirmation".to_string());
    }
    if !installer_path.is_file() {
        return Err(format!(
            "installer executable does not exist: {}",
            installer_path.display()
        ));
    }

    #[cfg(target_os = "windows")]
    {
        if installer_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| !value.eq_ignore_ascii_case("exe"))
            .unwrap_or(true)
        {
            return Err("client update installer must be a .exe file".to_string());
        }
        return Ok(InstallerLaunchPlan {
            program: "cmd".to_string(),
            args: vec![
                "/C".to_string(),
                "start".to_string(),
                "".to_string(),
                installer_path.to_string_lossy().to_string(),
            ],
        });
    }

    #[cfg(target_os = "macos")]
    {
        Ok(InstallerLaunchPlan {
            program: "open".to_string(),
            args: vec![installer_path.to_string_lossy().to_string()],
        })
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Ok(InstallerLaunchPlan {
            program: "xdg-open".to_string(),
            args: vec![installer_path.to_string_lossy().to_string()],
        })
    }
}

fn execute_launch(plan: &InstallerLaunchPlan) -> Result<(), String> {
    let mut command = background_command(&plan.program);
    command.args(&plan.args);
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("launch client installer: {error}"))
}

fn validate_download_request(input: &ClientUpdateDownloadPayload) -> Result<(), String> {
    if input.release_id.trim().is_empty() {
        return Err("releaseID cannot be empty".to_string());
    }
    if input.version.trim().is_empty() {
        return Err("version cannot be empty".to_string());
    }
    if input.package_url.trim().is_empty() {
        return Err("packageURL cannot be empty".to_string());
    }
    if !(input.package_url.starts_with("https://") || input.package_url.starts_with("http://")) {
        return Err("packageURL must use http or https".to_string());
    }
    if input.package_hash.trim().is_empty() {
        return Err("packageHash cannot be empty".to_string());
    }
    if input.package_size == 0 {
        return Err("packageSize must be greater than zero".to_string());
    }
    Ok(())
}

fn build_download_result(
    metadata: &ClientUpdateMetadata,
    metadata_path: &Path,
) -> ClientUpdateDownloadResultPayload {
    ClientUpdateDownloadResultPayload {
        release_id: metadata.release_id.clone(),
        version: metadata.version.clone(),
        file_name: metadata.file_name.clone(),
        staged_file_path: metadata.staged_file_path.clone(),
        metadata_path: metadata_path.to_string_lossy().to_string(),
        package_hash: metadata.package_hash.clone(),
        package_size: metadata.package_size,
        downloaded_at: metadata.downloaded_at.clone(),
        hash_verified: metadata.hash_verified,
        signature_status: metadata.signature_status.clone(),
        ready_to_install: metadata.ready_to_install(),
    }
}

fn write_metadata(path: &Path, metadata: &ClientUpdateMetadata) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("metadata path has no parent: {}", path.display()))?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("create metadata dir {}: {error}", parent.display()))?;
    let payload = serde_json::to_vec_pretty(metadata)
        .map_err(|error| format!("serialize client update metadata: {error}"))?;
    fs::write(path, payload)
        .map_err(|error| format!("write client update metadata {}: {error}", path.display()))
}

fn read_metadata(path: &Path) -> Result<ClientUpdateMetadata, String> {
    let bytes = fs::read(path)
        .map_err(|error| format!("read client update metadata {}: {error}", path.display()))?;
    serde_json::from_slice::<ClientUpdateMetadata>(&bytes)
        .map_err(|error| format!("parse client update metadata {}: {error}", path.display()))
}

fn staging_dir(root: &Path, release_id: &str, version: &str) -> PathBuf {
    root.join(sanitize_segment(release_id))
        .join(sanitize_segment(version))
}

fn resolve_file_name(file_name: Option<&str>, package_url: &str, version: &str) -> String {
    let candidate = file_name
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string)
        .or_else(|| {
            package_url
                .split('?')
                .next()
                .and_then(|value| value.rsplit('/').next())
                .filter(|value| !value.trim().is_empty())
                .map(ToString::to_string)
        })
        .unwrap_or_else(|| format!("EnterpriseAgentHubSetup-{version}.exe"));
    let sanitized = sanitize_segment(&candidate);
    if sanitized.to_ascii_lowercase().ends_with(".exe") {
        sanitized
    } else {
        format!("{sanitized}.exe")
    }
}

fn sanitize_segment(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "client-update".to_string()
    } else {
        trimmed.to_string()
    }
}

fn hashes_match(expected: &str, actual: &str) -> bool {
    expected
        .trim()
        .trim_start_matches("sha256:")
        .eq_ignore_ascii_case(actual.trim().trim_start_matches("sha256:"))
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn now_stamp(prefix: &str) -> String {
    format!("client-update-{prefix}-{}", now_millis())
}

fn inspect_signature(path: &Path) -> (String, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        let mut command = background_command("powershell");
        command.args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$sig = Get-AuthenticodeSignature -LiteralPath $args[0]; Write-Output ([string]$sig.Status); if ($sig.SignerCertificate) { Write-Output $sig.SignerCertificate.Subject }",
            &path.to_string_lossy(),
        ]);
        match command.output() {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                if !output.status.success() {
                    return (
                        "check_failed".to_string(),
                        Some(format!(
                            "Get-AuthenticodeSignature failed: {}",
                            stderr.trim()
                        )),
                    );
                }
                let mut lines = stdout.lines().map(str::trim).filter(|line| !line.is_empty());
                let raw_status = lines.next().unwrap_or("Unknown");
                let signer = lines.next().unwrap_or("");
                let status = if raw_status.eq_ignore_ascii_case("valid") {
                    "valid"
                } else {
                    "invalid"
                };
                let details = if signer.is_empty() {
                    Some(raw_status.to_string())
                } else {
                    Some(format!("{raw_status}: {signer}"))
                };
                (status.to_string(), details)
            }
            Err(error) => (
                "check_failed".to_string(),
                Some(format!("spawn signature verifier: {error}")),
            ),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        (
            "skipped_non_windows".to_string(),
            Some(format!(
                "Authenticode verification requires Windows; staged installer retained at {} for M3 real-machine validation.",
                path.display()
            )),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::sync::Mutex;
    use std::thread;

    static NETWORK_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn downloads_client_update_and_writes_metadata() {
        let _lock = NETWORK_LOCK.lock().expect("lock network");
        let temp = TestTemp::new("client-update-download");
        let package_bytes = b"MZ-stageable-client-update".to_vec();
        let package_url = serve_once(package_bytes.clone());
        let result = download_client_update_to_root(
            temp.path(),
            ClientUpdateDownloadPayload {
                release_id: "release-123".to_string(),
                version: "1.2.3".to_string(),
                package_url,
                package_hash: format!("sha256:{}", sha256_hex(&package_bytes)),
                package_size: package_bytes.len() as u64,
                file_name: Some("EnterpriseAgentHubSetup-1.2.3.exe".to_string()),
            },
        )
        .expect("download client update");

        assert!(Path::new(&result.staged_file_path).is_file());
        assert!(Path::new(&result.metadata_path).is_file());
        assert_eq!(result.file_name, "EnterpriseAgentHubSetup-1.2.3.exe");
        assert_eq!(result.signature_status, "pending");
        assert!(!result.ready_to_install);

        let metadata = read_metadata(Path::new(&result.metadata_path)).expect("read metadata");
        assert_eq!(metadata.verification_state, "downloaded");
        assert!(metadata.hash_verified);
        assert_eq!(metadata.package_size, package_bytes.len() as u64);
    }

    #[test]
    fn verify_updates_metadata_and_readiness() {
        let _lock = NETWORK_LOCK.lock().expect("lock network");
        let temp = TestTemp::new("client-update-verify");
        let package_bytes = b"MZ-client-update-verify".to_vec();
        let package_url = serve_once(package_bytes.clone());
        let download = download_client_update_to_root(
            temp.path(),
            ClientUpdateDownloadPayload {
                release_id: "release-verify".to_string(),
                version: "2.0.0".to_string(),
                package_url,
                package_hash: format!("sha256:{}", sha256_hex(&package_bytes)),
                package_size: package_bytes.len() as u64,
                file_name: Some("EnterpriseAgentHubSetup-2.0.0.exe".to_string()),
            },
        )
        .expect("download");

        let verification =
            verify_client_update_from_metadata(Path::new(&download.metadata_path)).expect("verify");
        assert!(verification.hash_verified);
        assert_eq!(
            verification.expected_hash,
            format!("sha256:{}", sha256_hex(&package_bytes))
        );

        if cfg!(target_os = "windows") {
            assert_ne!(verification.signature_status, "pending");
        } else {
            assert_eq!(verification.signature_status, "skipped_non_windows");
            assert!(verification.ready_to_install);
        }

        let metadata = read_metadata(Path::new(&download.metadata_path)).expect("read metadata");
        assert_eq!(metadata.verification_state, "verified");
        assert!(metadata.last_verified_at.is_some());
    }

    #[test]
    fn launch_plan_requires_confirmation_and_verified_metadata() {
        let temp = TestTemp::new("client-update-launch");
        let release_dir = temp.path().join("release-1").join("1.0.0");
        fs::create_dir_all(&release_dir).expect("create release dir");
        let installer_path = release_dir.join("EnterpriseAgentHubSetup-1.0.0.exe");
        fs::write(&installer_path, b"MZ-launchable").expect("write installer");
        let metadata_path = release_dir.join(CLIENT_UPDATE_METADATA_FILE);
        write_metadata(
            &metadata_path,
            &ClientUpdateMetadata {
                release_id: "release-1".to_string(),
                version: "1.0.0".to_string(),
                file_name: "EnterpriseAgentHubSetup-1.0.0.exe".to_string(),
                staged_file_path: installer_path.to_string_lossy().to_string(),
                package_url: "https://example.com/EnterpriseAgentHubSetup-1.0.0.exe".to_string(),
                package_hash: "sha256:deadbeef".to_string(),
                package_size: 11,
                downloaded_at: now_stamp("downloaded"),
                actual_hash: "sha256:deadbeef".to_string(),
                hash_verified: true,
                verification_state: "verified".to_string(),
                last_verified_at: Some(now_stamp("verified")),
                signature_status: if cfg!(target_os = "windows") {
                    "valid".to_string()
                } else {
                    "skipped_non_windows".to_string()
                },
                signature_details: None,
            },
        )
        .expect("write metadata");

        let error = launch_client_installer_with(&metadata_path, false, |_| Ok(()))
            .expect_err("launch should require confirmation");
        assert!(error.contains("explicit user confirmation"));

        let mut captured_plan: Option<InstallerLaunchPlan> = None;
        let launch = launch_client_installer_with(&metadata_path, true, |plan| {
            captured_plan = Some(plan.clone());
            Ok(())
        })
        .expect("launch through injected executor");
        assert!(launch.ready_to_install);

        let plan = captured_plan.expect("captured launch plan");
        #[cfg(target_os = "windows")]
        assert_eq!(plan.program, "cmd");
        #[cfg(target_os = "macos")]
        assert_eq!(plan.program, "open");
        #[cfg(all(unix, not(target_os = "macos")))]
        assert_eq!(plan.program, "xdg-open");
    }

    #[derive(Debug)]
    struct TestTemp {
        path: PathBuf,
    }

    impl TestTemp {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!("eah-{name}-{}", now_millis()));
            fs::create_dir_all(&path).expect("create temp dir");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TestTemp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn serve_once(body: Vec<u8>) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind listener");
        let address = listener.local_addr().expect("local addr");
        thread::spawn(move || {
            if let Ok((mut stream, _)) = listener.accept() {
                let mut request_buffer = [0u8; 1024];
                let _ = stream.read(&mut request_buffer);
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                stream
                    .write_all(response.as_bytes())
                    .expect("write response");
                stream.write_all(&body).expect("write body");
                stream.flush().expect("flush response");
            }
        });
        format!("http://{address}/EnterpriseAgentHubSetup.exe")
    }
}
