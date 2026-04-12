# EnterpriseAgentHub API (P1)

NestJS modular-monolith API lane for P1 基础闭环.

Owned scope: `apps/api/**`. Root workspace wiring and `packages/shared-contracts` are consumed once worker-1's slice gate is integrated.

## Local commands

```bash
cd apps/api
npm install
npm run typecheck
npm test
npm run lint
npm run build
```

## Source-start live smoke

Run this from the repo root when you want the real API path with live PostgreSQL, Redis, and MinIO:

```bash
cp infra/env/server.env.example infra/env/server.env
# adjust secrets/ports if needed
npm run p1:source-live-smoke
```

What it does:

- starts `postgres`, `redis`, `minio`, and `minio-init` from `infra/docker-compose.prod.yml`
- runs `npm run migrate:dev --workspace @enterprise-agent-hub/api`
- runs `npm run seed:dev --workspace @enterprise-agent-hub/api`
- starts the API from source with `npm run start:dev --workspace @enterprise-agent-hub/api`
- verifies `/health`, `/auth/login`, `/desktop/bootstrap`, `/skills`, `/notifications`, and `/admin/users`

If the API is already running, you can run the smoke checks alone:

```bash
npm run p1:live-smoke
```

## P1 endpoints

- `POST /auth/login`
- `POST /auth/logout`
- `GET /desktop/bootstrap`
- `POST /desktop/local-events`
- `GET /skills`
- `GET /skills/:skillID`
- `POST /skills/:skillID/download-ticket`
- `POST /skills/:skillID/star`
- `DELETE /skills/:skillID/star`
- `GET /notifications`
- `POST /notifications/mark-read`
- `GET /health`

The initial implementation uses deterministic seed data and DTO shapes aligned with `docs/RequirementDocument/21_p1_data_contract.md`; the migration contains the PostgreSQL FTS schema and idempotency constraints for the DB-backed follow-up.
