# ──────────────────────────────────────────────
# Web — Multi-stage: build con Vite, servir con Nginx
# ──────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Instalar dependencias
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Build
FROM deps AS build
COPY packages/types ./packages/types
COPY apps/web ./apps/web
RUN pnpm --filter @farmatuc/types build
RUN pnpm --filter @farmatuc/web build

# Runtime — Nginx
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
