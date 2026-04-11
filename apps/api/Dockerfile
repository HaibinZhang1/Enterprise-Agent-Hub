FROM node:22-bookworm-slim AS deps
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/dist ./apps/api/dist
COPY apps/api/src/database ./apps/api/src/database
COPY apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
