# Electron Runtime Capability Map

This note records the current Electron runtime capability ownership that remains relevant for verification gates and helper-exception references.

## Current ownership

- Window controls are implemented in the Electron main/preload boundary.
- Local Store bootstrap, package lifecycle, target scanning, and notification sync are implemented in the Electron local runtime layer.
- Client update download, verification, and installer launch are implemented in the Electron desktop update adapter.

## Exception-reference anchor

### client-update

Use this section only as the neutral reference target for helper-exception metadata when a future release needs to justify retaining a native helper for client-update verification semantics.
