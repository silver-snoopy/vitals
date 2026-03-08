# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests and root tsconfig for shared + backend only
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm ci --workspace=@vitals/shared --workspace=@vitals/backend

# Build shared first (backend depends on it)
COPY packages/shared ./packages/shared
RUN npm run build -w @vitals/shared

COPY packages/backend ./packages/backend
RUN npm run build -w @vitals/backend

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app

# Non-root user
RUN addgroup -S vitals && adduser -S vitals -G vitals

# Install prod dependencies only
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
RUN npm ci --workspace=@vitals/shared --workspace=@vitals/backend --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copy SQL migrations (not compiled by tsc, resolved relative to dist/db/migrate.js)
COPY packages/backend/src/db/migrations ./packages/backend/dist/db/migrations

USER vitals
EXPOSE 3001
CMD ["node", "packages/backend/dist/index.js"]
