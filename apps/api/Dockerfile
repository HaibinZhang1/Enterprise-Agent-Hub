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
COPY --from=node_runtime /usr/local/bin/pnpm /usr/local/bin/pnpm
COPY --from=node_runtime /usr/local/bin/pnpx /usr/local/bin/pnpx
COPY --from=node_runtime /usr/local/lib/node_modules/corepack /usr/local/lib/node_modules/corepack
COPY --from=node_runtime /lib/ld-musl-aarch64.so.1 /lib/ld-musl-aarch64.so.1
COPY --from=node_runtime /usr/lib/libstdc++.so.6 /usr/lib/libstdc++.so.6
COPY --from=node_runtime /usr/lib/libstdc++.so.6.0.34 /usr/lib/libstdc++.so.6.0.34
COPY --from=node_runtime /usr/lib/libgcc_s.so.1 /usr/lib/libgcc_s.so.1

RUN if [ "$API_HAS_POSTGRES_CLIENT" != "1" ]; then apk add --no-cache postgresql-client; fi
RUN if [ "$API_OFFLINE_WORKSPACE" != "1" ]; then corepack enable || true; fi
RUN if [ "$API_OFFLINE_WORKSPACE" != "1" ]; then pnpm config set registry "${PNPM_REGISTRY_URL}"; fi

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/web/package.json apps/web/package.json
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
