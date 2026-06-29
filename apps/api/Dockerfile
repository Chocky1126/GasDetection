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
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm --filter @gas-detection/api build

CMD ["sh", "-c", "pnpm prisma db push --schema prisma/schema.prisma && pnpm prisma:seed && pnpm --filter @gas-detection/api start"]
