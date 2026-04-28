# Domain Boundaries

This project uses explicit domain boundaries without introducing a DDD framework.

## Auth / Session

- Scope: login, session validation, menu permissions, caller identity
- Application: auth services and guards
- Infrastructure: auth session persistence in PostgreSQL

## Skills / Market

- Scope: skill list, detail, visibility, install/update eligibility, star state
- Application: skills facade, query service, authorization service, download service
- Infrastructure: SQL repository, ticket persistence

## Package / Storage

- Scope: package staging, object storage fallback, archive preview, package read/write
- Application: package storage orchestration
- Infrastructure: MinIO, local package storage, zip/unzip execution

## Publisher Submission

- Scope: author submit, withdraw, version/scope change requests
- Application: publishing facade / submission flow
- Infrastructure: review item persistence and package staging

## Review Governance

- Scope: precheck, reviewer routing, claim/review/return/reject/approve transitions
- Application: review workflow orchestration
- Domain: reviewer routing policy, workflow state policy
- Infrastructure: history persistence, job runs

## Admin Management

- Scope: departments, admin users, governed skills, review workbench entry
- Application: admin orchestration
- Infrastructure: admin SQL access

## Desktop Local Runtime / Adapter

- Scope: local bootstrap, scan, install, enable, disable, uninstall, path resolution
- Application: workspace state facade and local-sync slices
- Infrastructure: Tauri bridge and Rust commands

## Notification / Local Event Sync

- Scope: server notifications, local result notifications, offline event replay
- Application: merge policy and sync orchestration
- Infrastructure: local cache, server notification persistence

## Boundary rule

A module may orchestrate across domains only at the facade/application layer. Domain policies and repositories must stay inside their owning boundary.
