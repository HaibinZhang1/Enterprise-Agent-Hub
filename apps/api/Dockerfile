ARG NODE_RUNTIME_IMAGE=node:24-alpine
ARG API_BASE_IMAGE=node:24-alpine
FROM ${NODE_RUNTIME_IMAGE} AS node_runtime

ARG API_BASE_IMAGE
FROM ${API_BASE_IMAGE}

ARG API_HAS_POSTGRES_CLIENT=0
ARG API_OFFLINE_WORKSPACE=0
ARG PNPM_REGISTRY_URL=https://registry.npmjs.org

COPY --from=node_runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node_runtime /usr/local/bin/corepack /usr/local/bin/corepack
COPY --from=node_runtime /usr/local/lib/node_modules/corepack /usr/local/lib/node_modules/corepack

RUN if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache ca-certificates libgcc libstdc++; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && \
      apt-get install -y --no-install-recommends ca-certificates libstdc++6 && \
      rm -rf /var/lib/apt/lists/*; \
    fi
RUN if [ "$API_HAS_POSTGRES_CLIENT" != "1" ]; then \
      if command -v apk >/dev/null 2>&1; then \
        apk add --no-cache postgresql-client; \
      elif command -v apt-get >/dev/null 2>&1; then \
        apt-get update && \
        apt-get install -y --no-install-recommends postgresql-client && \
        rm -rf /var/lib/apt/lists/*; \
      else \
        echo "Unsupported base image: no apk or apt-get available for postgresql-client install." >&2; \
        exit 1; \
      fi; \
    fi
RUN if [ "$API_OFFLINE_WORKSPACE" != "1" ]; then corepack enable || true; corepack prepare pnpm@10.33.0 --activate; fi
RUN if [ "$API_OFFLINE_WORKSPACE" != "1" ]; then pnpm config set registry "${PNPM_REGISTRY_URL}"; fi

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/migrations/package.json packages/migrations/package.json

COPY . .

RUN if [ "$API_OFFLINE_WORKSPACE" = "1" ]; then \
      mkdir -p node_modules/@enterprise-agent-hub && \
      cp -R packages/contracts node_modules/@enterprise-agent-hub/contracts; \
    else \
      pnpm install --frozen-lockfile --ignore-scripts; \
    fi

ENV HOST=0.0.0.0
ENV PORT=8787
ENV PACKAGE_STORAGE_ROOT=/var/lib/enterprise-agent-hub/package-artifacts

CMD ["node", "apps/api/src/server.js"]
