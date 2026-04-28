# P1 Server Infrastructure

This directory is owned by worker-2 and provides the P1 API deployment base:

- `docker-compose.prod.yml` for Docker Compose v2 with health/dependency gates.
- `docker-compose.legacy.yml` for conservative legacy Compose environments.
- `env/server.env.example` template for API, PostgreSQL, Redis, and MinIO.
- `nginx/nginx.conf` optional intranet reverse proxy profile.

The API remains a NestJS modular monolith. Search is represented by PostgreSQL FTS migration objects only; no extra search service is introduced.
