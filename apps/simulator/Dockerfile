FROM node:22-alpine AS build
WORKDIR /app
ARG PNPM_VERSION=11.7.0
ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_REGISTRY" \
  && npm install -g "pnpm@${PNPM_VERSION}" \
  && pnpm config set registry "$NPM_REGISTRY"

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/simulator ./apps/simulator

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gas-detection/simulator build

CMD ["pnpm", "--filter", "@gas-detection/simulator", "start"]
