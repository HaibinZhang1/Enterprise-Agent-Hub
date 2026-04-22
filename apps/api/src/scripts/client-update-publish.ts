import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import {
  authHeaders,
  loginAdmin,
  optionalBooleanArg,
  optionalIntArg,
  optionalStringArg,
  parseArgs,
  requestJSON,
  requireStringArg,
  resolveAdminPassword,
  uploadArtifact,
} from './client-update-cli-lib';

interface ReleaseSummary {
  releaseID: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const serverURL = requireStringArg(args, 'server-url');
  const adminPhone = requireStringArg(args, 'admin-phone');
  const password = await resolveAdminPassword();
  const accessToken = await loginAdmin({ serverURL, adminPhone, password });

  const release = await requestJSON<ReleaseSummary>('/admin/client-updates/releases', {
    serverURL,
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      version: requireStringArg(args, 'version'),
      buildNumber: optionalStringArg(args, 'build-number'),
      platform: optionalStringArg(args, 'platform') ?? 'windows',
      arch: optionalStringArg(args, 'arch') ?? 'x64',
      channel: optionalStringArg(args, 'channel') ?? 'stable',
      mandatory: optionalBooleanArg(args, 'mandatory') ?? false,
      minSupportedVersion: optionalStringArg(args, 'min-supported-version') ?? null,
      rolloutPercent: optionalIntArg(args, 'rollout-percent') ?? 100,
      releaseNotes: requireStringArg(args, 'release-notes'),
    }),
  });

  const artifactPath = optionalStringArg(args, 'artifact');
  if (!artifactPath) {
    throw new Error('Missing required --artifact');
  }
  const resolvedArtifactPath = resolve(artifactPath);
  const artifactBuffer = await readFile(resolvedArtifactPath);
  const sha256 = `sha256:${createHash('sha256').update(artifactBuffer).digest('hex')}`;
  await uploadArtifact({
    serverURL,
    accessToken,
    releaseID: release.releaseID,
    artifactPath: resolvedArtifactPath,
    packageName: optionalStringArg(args, 'package-name') ?? basename(resolvedArtifactPath),
    sha256,
    signatureStatus: optionalStringArg(args, 'signature-status') ?? 'signed',
  });

  const publishNow = optionalBooleanArg(args, 'publish-now') ?? true;
  let finalRelease: unknown = { releaseID: release.releaseID };
  if (publishNow) {
    finalRelease = await requestJSON(`/admin/client-updates/releases/${encodeURIComponent(release.releaseID)}/publish`, {
      serverURL,
      method: 'POST',
      headers: {
        ...authHeaders(accessToken),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        mandatory: optionalBooleanArg(args, 'mandatory'),
        minSupportedVersion: optionalStringArg(args, 'min-supported-version') ?? null,
        rolloutPercent: optionalIntArg(args, 'rollout-percent'),
      }),
    });
  }

  console.log(JSON.stringify({ ok: true, release: finalRelease }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
