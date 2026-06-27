FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/simulator ./apps/simulator

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gas-detection/simulator build

CMD ["pnpm", "--filter", "@gas-detection/simulator", "start"]
