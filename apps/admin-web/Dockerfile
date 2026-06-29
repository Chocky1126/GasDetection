FROM node:22-alpine AS build
WORKDIR /app
ARG PNPM_VERSION=11.7.0
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN apk add --no-cache openssl \
  && npm config set registry "$NPM_REGISTRY" \
  && npm install -g "pnpm@${PNPM_VERSION}" \
  && pnpm config set registry "$NPM_REGISTRY"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/admin-web ./apps/admin-web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gas-detection/admin-web build

FROM nginx:1.27-alpine
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin-web/dist /usr/share/nginx/html
