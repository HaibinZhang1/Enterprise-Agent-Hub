# Windows Client Online Upgrade E2E Checklist

> Gate note: M1 is proof-of-path only. M3 is the release-approval gate.

## Preconditions

- [ ] Start from an older signed Windows x64 desktop build.
- [ ] Prepare a newer signed full installer package.
- [ ] Publish the release through the API/Linux CLI flow.

## Execution

1. [ ] Launch the older desktop client and sign in.
2. [ ] Confirm `/client-updates/check` returns the target release.
3. [ ] Confirm the top-bar notice and settings card show the same `releaseID` and `latestVersion`.
4. [ ] Trigger update download and record the managed staging path.
5. [ ] Record SHA-256 verification success.
6. [ ] Record Authenticode/signature verification success.
7. [ ] Confirm installer launch requires explicit user confirmation.
8. [ ] Complete the installer flow and relaunch into the new version.
9. [ ] Confirm the `installed` event is accepted by the server.
10. [ ] Confirm the previous prompt is cleared and does not return after one restart/refresh.

## Evidence to capture

- [ ] CLI publish output
- [ ] `/client-updates/check` response snapshot
- [ ] Download metadata path + staged installer path
- [ ] Hash/signature verification output
- [ ] Installer confirmation screenshot
- [ ] Relaunched version proof
- [ ] Installed-event proof
- [ ] Final prompt-cleared screenshot
