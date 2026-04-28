FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-contracts/package.json ./packages/shared-contracts/package.json
RUN npm ci --omit=dev --workspace @enterprise-agent-hub/api --workspace @enterprise-agent-hub/shared-contracts

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends zip unzip \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/api/dist ./apps/api/dist
COPY apps/api/src/database ./apps/api/src/database
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-contracts/dist ./packages/shared-contracts/dist
COPY packages/shared-contracts/package.json ./packages/shared-contracts/package.json
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
