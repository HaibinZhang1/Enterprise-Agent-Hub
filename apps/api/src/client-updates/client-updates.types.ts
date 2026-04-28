import type {
  ClientArtifactSignatureStatus,
  ClientReleaseArch,
  ClientReleaseChannel,
  ClientReleasePlatform,
  ClientReleaseStatus,
  ClientUpdateEventType,
} from '../common/p1-contracts';

export interface ClientUpdateAdminActorRow {
  user_id: string;
  role: 'normal_user' | 'admin';
  admin_level: number | null;
}

export interface ClientUpdateReleaseRow {
  release_id: string;
  version: string;
  build_number: string | null;
  platform: ClientReleasePlatform;
  arch: ClientReleaseArch;
  channel: ClientReleaseChannel;
  status: ClientReleaseStatus;
  mandatory: boolean;
  min_supported_version: string | null;
  rollout_percent: number;
  release_notes: string;
  created_by: string;
  published_by: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  artifact_id: string | null;
  artifact_bucket: string | null;
  artifact_object_key: string | null;
  artifact_package_name: string | null;
  artifact_size_bytes: string | number | null;
  artifact_sha256: string | null;
  artifact_signature_status: ClientArtifactSignatureStatus | null;
  artifact_created_at: Date | null;
  latest_event_at: Date | null;
  event_count: string | number;
}

export interface CreateClientUpdateReleaseInput {
  version: string;
  buildNumber: string | null;
  platform: ClientReleasePlatform;
  arch: ClientReleaseArch;
  channel: ClientReleaseChannel;
  mandatory: boolean;
  minSupportedVersion: string | null;
  rolloutPercent: number;
  releaseNotes: string;
  createdBy: string;
}

export interface RegisterClientUpdateArtifactInput {
  releaseID: string;
  bucket: string;
  objectKey: string;
  packageName: string;
  sizeBytes: number;
  sha256: `sha256:${string}`;
  signatureStatus: ClientArtifactSignatureStatus;
}

export interface ClientUpdateEventInput {
  releaseID: string | null;
  userID: string;
  deviceID: string;
  fromVersion: string;
  toVersion: string | null;
  eventType: ClientUpdateEventType;
  errorCode: string | null;
}

export interface ClientUpdateDownloadTicketRow {
  ticket: string;
  release_id: string;
  user_id: string | null;
  expires_at: Date;
}
