import process from 'node:process';
import { authHeaders, loginAdmin, optionalIntArg, parseArgs, requestJSON, requireStringArg, resolveAdminPassword } from './client-update-cli-lib';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const serverURL = requireStringArg(args, 'server-url');
  const adminPhone = requireStringArg(args, 'admin-phone');
  const releaseID = requireStringArg(args, 'release-id');
  const rolloutPercent = optionalIntArg(args, 'rollout-percent');
  if (rolloutPercent === undefined) {
    throw new Error('Missing required --rollout-percent');
  }
  const accessToken = await loginAdmin({ serverURL, adminPhone, password: await resolveAdminPassword() });
  const release = await requestJSON(`/admin/client-updates/releases/${encodeURIComponent(releaseID)}/rollout`, {
    serverURL,
    method: 'PATCH',
    headers: {
      ...authHeaders(accessToken),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ rolloutPercent }),
  });
  console.log(JSON.stringify({ ok: true, release }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
