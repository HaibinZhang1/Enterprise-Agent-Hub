# Server deploy scripts

Recommended P1 server deploy path:

```bash
cp infra/env/server.env.example infra/env/server.env
# edit secrets/image tags
./deploy/server-up.sh
```

Useful commands:

- `./deploy/server-check.sh` — validates Docker, Compose, ports, cgroups visibility, and named volume basics.
- `./deploy/server-up.sh` — starts PostgreSQL, Redis, MinIO, runs migration/seed jobs, then starts API.
- `COMPOSE_IMPL=legacy ./deploy/server-up.sh` — conservative legacy Compose path for older servers.
- `OFFLINE_MODE=true ./deploy/server-up.sh` — loads tar images before starting services.
- `./deploy/server-down.sh` — stops containers without deleting data.
- `./deploy/server-down.sh --remove-data` — destructive volume removal with explicit confirmation.

Scripts intentionally do not run `npm install` or build images on low-version target servers; deploy expects a prebuilt API image.
