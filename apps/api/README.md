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
