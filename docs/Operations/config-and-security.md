# Config and Security Operations

## Environment files

- The repository keeps `infra/env/server.env.example` as the canonical template.
- `infra/env/server.env` may exist only as a template mirror for local tooling and must not contain real secrets.
- Real deployment secrets must be injected out of band and must not be committed.

## Placeholder policy

The following values are placeholders and must not be used in real production deploys:

- `change-me`
- `change-me-before-deploy`
- `change-me-minio-secret`
- `minioadmin`

## Runtime config validation

The API validates core runtime configuration on startup:

- `API_PORT`
- `DATABASE_URL`
- `REDIS_URL` when set
- MinIO credentials and bucket names when MinIO is enabled
- `JWT_SECRET` quality in production

## Deployment checks

Run before deploy:

- `npm run check:env`
- `npm run check:docs`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Health and readiness

`/health` is the compatibility endpoint. It should be used to inspect:

- API liveness
- dependency status
- config validity
- readiness summary
- failure reasons for degraded state

## Security anti-patterns

- committing real env files
- keeping production secrets in compose defaults
- adding raw `process.env` reads throughout feature code
- logging access tokens, passwords, or secret material
- burying permission decisions in repositories
