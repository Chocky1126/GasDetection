# Gas Detection Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker Compose runnable MVP for the underground four-in-one gas detector management backend, admin console, data screen, MQTT simulator, and realtime data pipeline.

**Architecture:** Use a pnpm monorepo with four apps: NestJS API, Vue admin web, Vue screen web, and a Node MQTT simulator. The API owns business logic, stores data in PostgreSQL with Prisma, caches realtime state in Redis, consumes MQTT telemetry from Mosquitto, and broadcasts updates through Socket.IO WebSocket events.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis, MQTT.js, Socket.IO, Vue 3, Vite, Element Plus, ECharts, Docker Compose, Vitest/Jest.

---

## File Structure

Create and maintain these units:

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app.module.ts
│   │   │   ├── main.ts
│   │   │   ├── common/
│   │   │   ├── config/
│   │   │   ├── modules/
│   │   │   │   ├── alarms/
│   │   │   │   ├── alarm-rules/
│   │   │   │   ├── audit-logs/
│   │   │   │   ├── auth/
│   │   │   │   ├── base-stations/
│   │   │   │   ├── calibrations/
│   │   │   │   ├── devices/
│   │   │   │   ├── health/
│   │   │   │   ├── monitor/
│   │   │   │   ├── mqtt/
│   │   │   │   ├── personnel/
│   │   │   │   ├── prisma/
│   │   │   │   ├── realtime/
│   │   │   │   ├── redis/
│   │   │   │   ├── roles/
│   │   │   │   ├── teams/
│   │   │   │   ├── areas/
│   │   │   │   └── users/
│   │   │   └── test/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsconfig.build.json
│   ├── admin-web/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── router/
│   │   │   ├── stores/
│   │   │   ├── styles/
│   │   │   └── views/
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   ├── screen-web/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── stores/
│   │   │   ├── styles/
│   │   │   └── views/
│   │   ├── Dockerfile
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── simulator/
│       ├── src/
│       │   ├── device-factory.ts
│       │   ├── index.ts
│       │   ├── simulator.service.ts
│       │   └── telemetry.ts
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── constants.ts
│       │   ├── enums.ts
│       │   ├── mqtt.ts
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker/
│   ├── mosquitto/mosquitto.conf
│   └── nginx/default.conf
├── docs/
│   └── superpowers/
│       ├── specs/2026-06-27-gas-detection-platform-design.md
│       └── plans/2026-06-27-gas-detection-platform.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── README.md
```

## Task 1: Workspace, Shared Package, and Environment Contract

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/enums.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/mqtt.ts`
- Create: `packages/shared/src/index.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create root workspace files**

`package.json` must expose workspace scripts:

```json
{
  "name": "gas-detection-platform",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev:api": "pnpm --filter @gas-detection/api dev",
    "dev:admin": "pnpm --filter @gas-detection/admin-web dev",
    "dev:screen": "pnpm --filter @gas-detection/screen-web dev",
    "dev:simulator": "pnpm --filter @gas-detection/simulator dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "prisma:generate": "prisma generate --schema prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema prisma/schema.prisma",
    "prisma:seed": "tsx prisma/seed.ts"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@gas-detection/shared": ["packages/shared/src/index.ts"]
    }
  }
}
```

- [ ] **Step 2: Define the environment contract**

`.env.example`:

```dotenv
NODE_ENV=development

POSTGRES_DB=gas_detection
POSTGRES_USER=gas_user
POSTGRES_PASSWORD=gas_password
DATABASE_URL=postgresql://gas_user:gas_password@postgres:5432/gas_detection?schema=public

REDIS_URL=redis://redis:6379
MQTT_URL=mqtt://mosquitto:1883

JWT_SECRET=local-dev-secret-change-me
JWT_EXPIRES_IN=8h

API_PORT=3000
ADMIN_WEB_PORT=5173
SCREEN_WEB_PORT=5174

SIMULATOR_DEVICE_COUNT=100
SIMULATOR_INTERVAL_MS=3000
```

- [ ] **Step 3: Create the shared package**

`packages/shared/src/enums.ts`:

```ts
export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  FAULT = 'FAULT',
}

export enum SensorStatus {
  NORMAL = 'NORMAL',
  FAULT = 'FAULT',
}

export enum GasType {
  CH4 = 'CH4',
  O2 = 'O2',
  CO = 'CO',
  H2S = 'H2S',
  BATTERY = 'BATTERY',
}

export enum AlarmSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlarmStatus {
  ACTIVE = 'ACTIVE',
  ACKED = 'ACKED',
  RESOLVED = 'RESOLVED',
}

export enum RuleOperator {
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  EQ = 'EQ',
}
```

`packages/shared/src/constants.ts`:

```ts
export const DEFAULT_DEVICE_COUNT = 100;
export const DEVICE_CODE_PREFIX = 'GAS';
export const REALTIME_NAMESPACE = '/realtime';
export const ADMIN_USERNAME = 'admin';
export const ADMIN_DEFAULT_PASSWORD = 'admin123456';
```

`packages/shared/src/mqtt.ts`:

```ts
export const MQTT_TOPICS = {
  telemetry: 'gas/devices/+/telemetry',
  status: 'gas/devices/+/status',
  fault: 'gas/devices/+/fault',
  alarm: 'gas/devices/+/alarm',
} as const;

export function deviceTelemetryTopic(deviceCode: string): string {
  return `gas/devices/${deviceCode}/telemetry`;
}
```

`packages/shared/src/index.ts`:

```ts
export * from './constants';
export * from './enums';
export * from './mqtt';
```

- [ ] **Step 4: Verify workspace metadata**

Run:

```bash
pnpm install
pnpm --filter @gas-detection/shared build
```

Expected: dependencies install and the shared package compiles.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .env.example packages/shared .gitignore
git commit -m "chore: initialize gas detection workspace"
```

## Task 2: Prisma Schema and Seed Data

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the Prisma schema**

Define the datasource, Prisma client generator, enums, indexes, and all models from the approved spec. Important model constraints:

```prisma
model Device {
  id            String          @id @default(cuid())
  code          String          @unique
  name          String
  model         String
  serialNumber  String          @unique
  status        DeviceStatus    @default(OFFLINE)
  areaId        String?
  baseStationId String?
  area          Area?           @relation(fields: [areaId], references: [id])
  baseStation   BaseStation?    @relation(fields: [baseStationId], references: [id])
  snapshot      DeviceSnapshot?
  telemetry     TelemetryRecord[]
  faults        DeviceFault[]
  alarms        AlarmEvent[]
  calibrations  CalibrationRecord[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

model TelemetryRecord {
  id            String       @id @default(cuid())
  deviceId      String
  device        Device       @relation(fields: [deviceId], references: [id])
  ch4           Float
  o2            Float
  co            Float
  h2s           Float
  batteryLevel  Int
  lng           Float
  lat           Float
  depth         Float
  onlineStatus  DeviceStatus
  sensorStatus  SensorStatus
  reportedAt    DateTime
  createdAt     DateTime     @default(now())

  @@index([deviceId, reportedAt])
  @@index([reportedAt])
}
```

Use explicit join models for user roles, role permissions, and personnel teams. Add indexes for `AlarmEvent.status`, `AlarmEvent.startedAt`, `DeviceSnapshot.status`, and `AuditLog.createdAt`.

- [ ] **Step 2: Write deterministic seed data**

`prisma/seed.ts` must:

```ts
const areaNames = ['一采区', '二采区', '运输巷', '回风巷', '中央变电所'];
const alarmRules = [
  { name: '甲烷高限报警', gasType: 'CH4', operator: 'GTE', thresholdValue: 1.0, severity: 'HIGH' },
  { name: '氧气低限报警', gasType: 'O2', operator: 'LTE', thresholdValue: 19.5, severity: 'HIGH' },
  { name: '一氧化碳报警', gasType: 'CO', operator: 'GTE', thresholdValue: 24, severity: 'MEDIUM' },
  { name: '硫化氢报警', gasType: 'H2S', operator: 'GTE', thresholdValue: 10, severity: 'MEDIUM' },
];
```

Create:

- `admin`, `operator`, `viewer` roles.
- One admin user with username `admin` and password hash for `admin123456`.
- Permissions for all first-phase modules.
- 5 areas and 10 base stations.
- 100 devices from `GAS-0001` to `GAS-0100` and one snapshot per device.
- Default alarm rules listed above.

- [ ] **Step 3: Verify schema generation**

Run:

```bash
pnpm prisma format --schema prisma/schema.prisma
pnpm prisma:generate
```

Expected: Prisma Client generation succeeds.

- [ ] **Step 4: Commit**

```bash
git add prisma package.json
git commit -m "feat: add prisma schema and seed data"
```

## Task 3: NestJS API Bootstrap, Config, Prisma, Redis, and Health

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/config/env.validation.ts`
- Create: `apps/api/src/common/http-exception.filter.ts`
- Create: `apps/api/src/common/response.interceptor.ts`
- Create: `apps/api/src/modules/prisma/prisma.module.ts`
- Create: `apps/api/src/modules/prisma/prisma.service.ts`
- Create: `apps/api/src/modules/redis/redis.module.ts`
- Create: `apps/api/src/modules/redis/redis.service.ts`
- Create: `apps/api/src/modules/health/health.module.ts`
- Create: `apps/api/src/modules/health/health.controller.ts`
- Create: `apps/api/src/test/health.e2e-spec.ts`

- [ ] **Step 1: Create the API package**

Use Nest dependencies:

```json
{
  "name": "@gas-detection/api",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "jest --passWithNoTests",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.15",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.15",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.15",
    "@nestjs/platform-socket.io": "^10.4.15",
    "@nestjs/swagger": "^8.1.0",
    "@nestjs/websockets": "^10.4.15",
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "ioredis": "^5.4.1",
    "mqtt": "^5.10.3",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.8",
    "@nestjs/testing": "^10.4.15",
    "@types/bcryptjs": "^2.4.6",
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.2",
    "@types/passport-jwt": "^4.0.1",
    "eslint": "^9.17.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Bootstrap NestJS with Swagger**

`apps/api/src/main.ts` must:

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('井下四合一气体检测平台 API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.API_PORT ?? 3000);
}
```

- [ ] **Step 3: Add Prisma and Redis services**

`PrismaService` extends `PrismaClient` and connects during module init. `RedisService` wraps one `ioredis` client from `REDIS_URL` and exposes `get`, `set`, `publish`, and `quit`.

- [ ] **Step 4: Add health endpoint and test**

`GET /api/v1/health` returns:

```json
{
  "status": "ok",
  "service": "gas-detection-api"
}
```

E2E test:

```ts
it('/health (GET)', () => {
  return request(app.getHttpServer())
    .get('/api/v1/health')
    .expect(200)
    .expect(({ body }) => {
      expect(body.data.status).toBe('ok');
    });
});
```

- [ ] **Step 5: Verify API compilation**

Run:

```bash
pnpm install
pnpm --filter @gas-detection/api typecheck
pnpm --filter @gas-detection/api test
```

Expected: TypeScript and Jest pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: bootstrap nest api"
```

## Task 4: Authentication, JWT, and RBAC

**Files:**
- Create: `apps/api/src/modules/auth/*`
- Create: `apps/api/src/modules/users/*`
- Create: `apps/api/src/modules/roles/*`
- Create: `apps/api/src/common/decorators/current-user.decorator.ts`
- Create: `apps/api/src/common/decorators/permissions.decorator.ts`
- Create: `apps/api/src/common/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/common/guards/permissions.guard.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write auth DTOs and guards**

`LoginDto`:

```ts
export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}
```

`Permissions` decorator:

```ts
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
```

`PermissionsGuard` must allow admin users and require every declared permission to exist in the JWT payload permissions array.

- [ ] **Step 2: Implement auth service**

`AuthService.login(dto)` must:

1. Find an enabled user by username.
2. Compare password with `bcryptjs.compare`.
3. Load roles and permissions.
4. Sign JWT with `sub`, `username`, `roles`, and `permissions`.
5. Return `{ accessToken, user }`.

- [ ] **Step 3: Implement endpoints**

Required endpoints:

```text
POST /api/v1/auth/login
GET  /api/v1/auth/profile
GET  /api/v1/users
POST /api/v1/users
PATCH /api/v1/users/:id
DELETE /api/v1/users/:id
GET  /api/v1/roles
POST /api/v1/roles
PATCH /api/v1/roles/:id
DELETE /api/v1/roles/:id
```

- [ ] **Step 4: Add auth tests**

Use the seeded admin user and assert:

```ts
expect(loginResponse.body.data.accessToken).toEqual(expect.any(String));
expect(profileResponse.body.data.username).toBe('admin');
```

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @gas-detection/api test
pnpm --filter @gas-detection/api typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth apps/api/src/modules/users apps/api/src/modules/roles apps/api/src/common apps/api/src/app.module.ts
git commit -m "feat: add auth and rbac"
```

## Task 5: Core Business CRUD Modules

**Files:**
- Create: `apps/api/src/modules/devices/*`
- Create: `apps/api/src/modules/alarm-rules/*`
- Create: `apps/api/src/modules/alarms/*`
- Create: `apps/api/src/modules/personnel/*`
- Create: `apps/api/src/modules/teams/*`
- Create: `apps/api/src/modules/areas/*`
- Create: `apps/api/src/modules/base-stations/*`
- Create: `apps/api/src/modules/calibrations/*`
- Create: `apps/api/src/modules/audit-logs/*`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Establish a consistent module shape**

Each CRUD module must include:

```text
dto/create-*.dto.ts
dto/update-*.dto.ts
*.controller.ts
*.module.ts
*.service.ts
```

The service pattern:

```ts
findAll(query: ListQueryDto) {
  return this.prisma.device.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
}
```

Return list metadata as `{ items, total, page, pageSize }`.

- [ ] **Step 2: Implement device endpoints**

Required behavior:

- `GET /devices` filters by `keyword`, `status`, `areaId`, `baseStationId`.
- `POST /devices` creates the device and an initial snapshot in one transaction.
- `PATCH /devices/:id` updates name, model, area, base station, and status.
- `GET /devices/:id/telemetry` returns latest records ordered by `reportedAt desc`.
- `GET /devices/:id/alarms` returns latest alarms ordered by `startedAt desc`.

- [ ] **Step 3: Implement alarm rule and alarm center endpoints**

Alarm rules CRUD uses `gasType`, `operator`, `thresholdValue`, `severity`, `durationSeconds`, and `enabled`.

Alarm center supports:

```text
GET /alarms?status=ACTIVE&severity=HIGH
PATCH /alarms/:id/ack
PATCH /alarms/:id/resolve
```

Acknowledging sets `status=ACKED` and `ackedAt=now`. Resolving sets `status=RESOLVED` and `resolvedAt=now`.

- [ ] **Step 4: Implement personnel, team, area, base station, calibration, and audit log endpoints**

Each module must expose the routes listed in the spec. `AuditLogsController` is read-only in first phase.

- [ ] **Step 5: Add service tests**

Cover:

```text
DevicesService creates device plus snapshot.
AlarmRulesService validates thresholdValue is non-negative.
AlarmsService ack and resolve update timestamps.
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @gas-detection/api test
pnpm --filter @gas-detection/api typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules apps/api/src/app.module.ts
git commit -m "feat: add core management apis"
```

## Task 6: MQTT Ingestion, Alarm Evaluation, Monitor Aggregates, and WebSocket

**Files:**
- Create: `apps/api/src/modules/mqtt/*`
- Create: `apps/api/src/modules/realtime/*`
- Create: `apps/api/src/modules/monitor/*`
- Create: `apps/api/src/modules/alarms/alarm-evaluator.service.ts`
- Modify: `apps/api/src/modules/alarms/alarms.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Implement the realtime gateway**

Use Socket.IO namespace `/realtime`. Push these events:

```ts
export const RealtimeEvents = {
  SnapshotUpdated: 'device.snapshot.updated',
  TelemetryCreated: 'telemetry.created',
  AlarmCreated: 'alarm.created',
  AlarmUpdated: 'alarm.updated',
  DeviceStatusChanged: 'device.status.changed',
  ScreenOverviewUpdated: 'screen.overview.updated',
} as const;
```

The gateway allows clients to connect and logs `subscribe.monitor` and `subscribe.screen` messages.

- [ ] **Step 2: Implement MQTT subscriber**

On module init, connect to `MQTT_URL`, subscribe to all four topics, parse JSON payloads, and route telemetry payloads to `TelemetryIngestionService`.

Invalid JSON must be logged and skipped without crashing the process.

- [ ] **Step 3: Implement telemetry ingestion**

For every telemetry payload:

1. Find device by `deviceCode`.
2. Create `TelemetryRecord`.
3. Upsert `DeviceSnapshot`.
4. Set Redis key `device:snapshot:{deviceCode}`.
5. Evaluate alarm rules.
6. Emit WebSocket events.

- [ ] **Step 4: Implement alarm evaluator**

Rule comparison:

```ts
function isTriggered(value: number, operator: RuleOperator, threshold: number): boolean {
  switch (operator) {
    case RuleOperator.GT: return value > threshold;
    case RuleOperator.GTE: return value >= threshold;
    case RuleOperator.LT: return value < threshold;
    case RuleOperator.LTE: return value <= threshold;
    case RuleOperator.EQ: return value === threshold;
  }
}
```

When a rule is triggered, create one active alarm per device/rule if none exists. When the rule is no longer triggered, resolve an active alarm for that device/rule.

- [ ] **Step 5: Implement monitor endpoints**

Required endpoints:

```text
GET /api/v1/monitor/snapshots
GET /api/v1/monitor/trends
GET /api/v1/monitor/status-distribution
GET /api/v1/monitor/area-risk-ranking
GET /api/v1/monitor/overview
```

`overview` returns:

```json
{
  "totalDevices": 100,
  "onlineDevices": 0,
  "offlineDevices": 100,
  "faultDevices": 0,
  "activeAlarms": 0,
  "lowBatteryDevices": 0
}
```

- [ ] **Step 6: Add tests**

Cover:

```text
TelemetryIngestionService creates telemetry and snapshot.
AlarmEvaluator creates active alarm when CH4 >= 1.0.
AlarmEvaluator resolves active alarm when CH4 returns below threshold.
MonitorService computes overview counts.
```

- [ ] **Step 7: Verify**

Run:

```bash
pnpm --filter @gas-detection/api test
pnpm --filter @gas-detection/api typecheck
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/mqtt apps/api/src/modules/realtime apps/api/src/modules/monitor apps/api/src/modules/alarms apps/api/src/app.module.ts
git commit -m "feat: add realtime telemetry pipeline"
```

## Task 7: MQTT Simulator

**Files:**
- Create: `apps/simulator/package.json`
- Create: `apps/simulator/tsconfig.json`
- Create: `apps/simulator/src/device-factory.ts`
- Create: `apps/simulator/src/telemetry.ts`
- Create: `apps/simulator/src/simulator.service.ts`
- Create: `apps/simulator/src/index.ts`
- Create: `apps/simulator/src/telemetry.test.ts`

- [ ] **Step 1: Create simulator package**

Scripts:

```json
{
  "name": "@gas-detection/simulator",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gas-detection/shared": "workspace:*",
    "mqtt": "^5.10.3"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Generate 100 deterministic devices**

`createDevices(count)` returns codes from `GAS-0001` to `GAS-0100`, area/base station indexes, base coordinates, and battery level.

- [ ] **Step 3: Generate realistic telemetry**

Normal ranges:

```text
CH4: 0.05 - 0.80
O2: 20.0 - 21.0
CO: 0 - 18
H2S: 0 - 6
batteryLevel: 20 - 100
```

Random abnormal events:

```text
CH4 alarm: 1.0 - 2.5
O2 low alarm: 16.0 - 19.4
CO alarm: 24 - 80
H2S alarm: 10 - 40
low battery: 5 - 15
offline: publish status OFFLINE and skip telemetry for one cycle
sensor fault: sensorStatus FAULT
```

- [ ] **Step 4: Publish MQTT messages**

`SimulatorService.start()` connects to `MQTT_URL`, publishes one telemetry message per online device every `SIMULATOR_INTERVAL_MS`, and logs aggregate counts each cycle.

- [ ] **Step 5: Add tests**

Assert:

```ts
expect(createDevices(100)).toHaveLength(100);
expect(createDevices(1)[0].code).toBe('GAS-0001');
expect(generateTelemetry(device).batteryLevel).toBeGreaterThanOrEqual(0);
expect(generateTelemetry(device).batteryLevel).toBeLessThanOrEqual(100);
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @gas-detection/simulator test
pnpm --filter @gas-detection/simulator typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/simulator
git commit -m "feat: add mqtt device simulator"
```

## Task 8: Admin Web Application

**Files:**
- Create: `apps/admin-web/package.json`
- Create: `apps/admin-web/index.html`
- Create: `apps/admin-web/tsconfig.json`
- Create: `apps/admin-web/vite.config.ts`
- Create: `apps/admin-web/src/main.ts`
- Create: `apps/admin-web/src/App.vue`
- Create: `apps/admin-web/src/api/http.ts`
- Create: `apps/admin-web/src/api/modules.ts`
- Create: `apps/admin-web/src/router/index.ts`
- Create: `apps/admin-web/src/stores/auth.ts`
- Create: `apps/admin-web/src/stores/realtime.ts`
- Create: `apps/admin-web/src/layout/AdminLayout.vue`
- Create: `apps/admin-web/src/views/*.vue`
- Create: `apps/admin-web/src/styles/main.css`

- [ ] **Step 1: Create Vite Vue app**

Dependencies:

```json
{
  "dependencies": {
    "@element-plus/icons-vue": "^2.3.1",
    "axios": "^1.7.9",
    "element-plus": "^2.9.1",
    "pinia": "^2.3.0",
    "socket.io-client": "^4.8.1",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.5",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Build login and route guard**

`/login` posts to `/api/v1/auth/login`, stores token in Pinia and localStorage, then redirects to `/dashboard`. Protected routes redirect to `/login` without a token.

- [ ] **Step 3: Build admin layout**

Use a compact workbench layout:

```text
left sidebar: dashboard, devices, monitor, alarm rules, alarms, personnel, teams, areas, base stations, calibrations, audit logs, system users, system roles
top bar: platform title, current user, logout
main content: router view
```

- [ ] **Step 4: Implement views**

Views must call the matching REST endpoints:

```text
DashboardView.vue: monitor overview cards and active alarms
DevicesView.vue: table, filters, create/edit drawer
MonitorView.vue: realtime snapshot table and gas values
AlarmRulesView.vue: rule table and form
AlarmsView.vue: ack/resolve actions
PersonnelView.vue: personnel CRUD
TeamsView.vue: team CRUD
AreasView.vue: area CRUD
BaseStationsView.vue: base station CRUD
CalibrationsView.vue: calibration records
AuditLogsView.vue: read-only logs table
SystemUsersView.vue: users table
SystemRolesView.vue: roles table
```

- [ ] **Step 5: Add WebSocket realtime store**

Connect to `/realtime`, listen for `device.snapshot.updated`, `alarm.created`, and `screen.overview.updated`, and update the dashboard and monitor pages without manual refresh.

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --filter @gas-detection/admin-web typecheck
pnpm --filter @gas-detection/admin-web build
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web
git commit -m "feat: add admin console"
```

## Task 9: Data Screen Application

**Files:**
- Create: `apps/screen-web/package.json`
- Create: `apps/screen-web/index.html`
- Create: `apps/screen-web/tsconfig.json`
- Create: `apps/screen-web/vite.config.ts`
- Create: `apps/screen-web/src/main.ts`
- Create: `apps/screen-web/src/App.vue`
- Create: `apps/screen-web/src/api/http.ts`
- Create: `apps/screen-web/src/stores/screen.ts`
- Create: `apps/screen-web/src/components/*.vue`
- Create: `apps/screen-web/src/views/ScreenView.vue`
- Create: `apps/screen-web/src/styles/main.css`

- [ ] **Step 1: Create Vite Vue ECharts app**

Dependencies:

```json
{
  "dependencies": {
    "axios": "^1.7.9",
    "echarts": "^5.5.1",
    "pinia": "^2.3.0",
    "socket.io-client": "^4.8.1",
    "vue": "^3.5.13"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.5",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Build the data screen layout**

`ScreenView.vue` layout:

```text
top: title, current time, overview metrics
left column: realtime alarm list
center: underground map with area blocks, base stations, and device points
right column: status distribution and area risk ranking
bottom: gas trend chart
```

- [ ] **Step 3: Build chart components**

Create:

```text
OverviewMetrics.vue
MineMap.vue
RealtimeAlarms.vue
GasTrendChart.vue
StatusDistribution.vue
AreaRiskRanking.vue
```

Each chart initializes ECharts in `onMounted`, updates in `watch`, and disposes in `onBeforeUnmount`.

- [ ] **Step 4: Connect REST and WebSocket**

On load, request:

```text
/api/v1/monitor/overview
/api/v1/monitor/snapshots
/api/v1/monitor/trends
/api/v1/monitor/status-distribution
/api/v1/monitor/area-risk-ranking
/api/v1/alarms?status=ACTIVE
```

Then connect to `/realtime` and refresh affected store state when events arrive.

- [ ] **Step 5: Verify**

Run:

```bash
pnpm --filter @gas-detection/screen-web typecheck
pnpm --filter @gas-detection/screen-web build
```

- [ ] **Step 6: Commit**

```bash
git add apps/screen-web
git commit -m "feat: add realtime data screen"
```

## Task 10: Docker Compose, Nginx, and Runtime Wiring

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/mosquitto/mosquitto.conf`
- Create: `docker/nginx/default.conf`
- Create: `apps/api/Dockerfile`
- Create: `apps/admin-web/Dockerfile`
- Create: `apps/screen-web/Dockerfile`
- Create: `apps/simulator/Dockerfile`
- Modify: `.env.example`

- [ ] **Step 1: Configure Mosquitto**

`docker/mosquitto/mosquitto.conf`:

```conf
listener 1883
allow_anonymous true
persistence false
log_dest stdout
```

- [ ] **Step 2: Create Dockerfiles**

Each app Dockerfile must:

1. Install workspace dependencies with `pnpm install --frozen-lockfile`.
2. Generate Prisma client for API.
3. Build only the target app.
4. Start the app with its package script.

- [ ] **Step 3: Create docker-compose.yml**

Services:

```text
postgres: exposes 5432, healthcheck pg_isready
redis: exposes 6379, healthcheck redis-cli ping
mosquitto: exposes 1883 and 9001
api: depends on postgres, redis, mosquitto
admin-web: depends on api
screen-web: depends on api
simulator: depends on api and mosquitto
```

Published ports:

```text
api: 3000
admin-web: 8080
screen-web: 8081
mosquitto: 1883
postgres: 5432
redis: 6379
```

- [ ] **Step 4: Verify container boot**

Run:

```bash
docker compose build
docker compose up -d postgres redis mosquitto
docker compose run --rm api pnpm prisma migrate deploy --schema prisma/schema.prisma
docker compose run --rm api pnpm prisma:seed
docker compose up -d
docker compose ps
```

Expected: all services show `running` or `healthy`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker apps/api/Dockerfile apps/admin-web/Dockerfile apps/screen-web/Dockerfile apps/simulator/Dockerfile .env.example
git commit -m "chore: add docker compose runtime"
```

## Task 11: README and End-to-End Verification

**Files:**
- Create: `README.md`
- Create: `docs/api/http-examples.md`
- Modify: package scripts if verification exposes command gaps.

- [ ] **Step 1: Write README**

README must include:

```text
项目简介
技术栈
目录结构
本地开发启动
Docker Compose 一键启动
默认账号 admin / admin123456
服务地址
Swagger: http://localhost:3000/api/docs
管理后台: http://localhost:8080
数据大屏: http://localhost:8081
MQTT Broker: mqtt://localhost:1883
常用验证命令
```

- [ ] **Step 2: Add HTTP examples**

`docs/api/http-examples.md` must show:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123456"}'

curl http://localhost:3000/api/v1/monitor/overview \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm install
pnpm prisma:generate
pnpm -r typecheck
pnpm -r test
pnpm -r build
docker compose config
```

If Docker is available, run:

```bash
docker compose up --build -d
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/docs
docker compose logs --tail=80 simulator
docker compose down
```

- [ ] **Step 4: Commit**

```bash
git add README.md docs/api package.json pnpm-lock.yaml
git commit -m "docs: add startup and verification guide"
```

## Spec Coverage Self-Review

- User login and role permissions: Task 4.
- Device management: Task 5 and admin view in Task 8.
- Realtime monitoring: Task 6, Task 8, Task 9.
- Alarm rule configuration: Task 5 and Task 8.
- Alarm center: Task 5, Task 6, Task 8, Task 9.
- Personnel and team management: Task 5 and Task 8.
- Area and base station management: Task 5 and Task 8.
- Calibration records: Task 5 and Task 8.
- Operation logs: Task 5 and Task 8.
- Data screen modules: Task 9.
- WebSocket realtime refresh: Task 6, Task 8, Task 9.
- Swagger docs: Task 3.
- Docker Compose one-command startup: Task 10 and Task 11.
- Simulated 100 devices through MQTT: Task 2 and Task 7.
