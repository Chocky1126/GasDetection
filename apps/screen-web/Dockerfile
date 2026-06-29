FROM node:22-alpine AS build
WORKDIR /app
ARG PNPM_VERSION=11.7.0
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_REGISTRY" \
  && npm install -g "pnpm@${PNPM_VERSION}" \
  && pnpm config set registry "$NPM_REGISTRY"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/screen-web ./apps/screen-web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gas-detection/screen-web build

FROM nginx:1.27-alpine
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/screen-web/dist /usr/share/nginx/html
