FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
RUN pnpm --filter @gas-detection/api build

CMD ["sh", "-c", "pnpm prisma db push --schema prisma/schema.prisma && pnpm prisma:seed && pnpm --filter @gas-detection/api start"]
