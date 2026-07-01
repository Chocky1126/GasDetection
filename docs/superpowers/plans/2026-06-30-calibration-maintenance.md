# Calibration Maintenance Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved calibration maintenance workflow: structured calibration results, due/overdue tracking, personnel/team links, audit logs, admin workbench, and device calibration history.

**Architecture:** Extend the existing Prisma model and NestJS calibration module instead of introducing a new work-order subsystem. Keep due status as a service-level computed concept over `CalibrationRecord` grouped by device and gas type. Replace the generic admin calibration table with a focused workbench while keeping the existing Element Plus visual language.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Vue 3, Vite, Element Plus, Jest, Docker Compose.

---

## File Map

- Modify `prisma/schema.prisma`: add `CalibrationResult`, personnel/team relations, result metadata, and due indexes.
- Modify `prisma/seed.ts`: seed a small set of personnel/team-linked calibration records so the workbench has useful demo data.
- Create `apps/api/src/modules/calibrations/dto/calibration-query.dto.ts`: list filters and due-status enum.
- Modify `apps/api/src/modules/calibrations/dto/create-calibration.dto.ts`: personnel/team fields and numeric validation.
- Create `apps/api/src/modules/calibrations/calibrations.service.spec.ts`: TDD coverage for result calculation, create audit behavior, overview, due devices, and filters.
- Modify `apps/api/src/modules/calibrations/calibrations.service.ts`: result calculation, list filters, overview, due-device aggregation, audit logs.
- Modify `apps/api/src/modules/calibrations/calibrations.controller.ts`: add overview and due-device routes, pass current user on create.
- Create `apps/api/src/modules/devices/dto/device-calibration-query.dto.ts`: device calibration history filters.
- Modify `apps/api/src/modules/devices/devices.service.spec.ts`: device calibration history coverage.
- Modify `apps/api/src/modules/devices/devices.service.ts`: `findCalibrations`.
- Modify `apps/api/src/modules/devices/devices.controller.ts`: `GET /devices/:id/calibrations`.
- Modify `apps/admin-web/src/api/modules.ts`: calibration overview/due/history helpers.
- Replace `apps/admin-web/src/views/CalibrationsView.vue`: calibration workbench.
- Modify `apps/admin-web/src/views/DevicesView.vue`: calibration history in the device drawer.

---

### Task 1: Prisma Schema And DTO Contracts

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `apps/api/src/modules/calibrations/dto/create-calibration.dto.ts`
- Create: `apps/api/src/modules/calibrations/dto/calibration-query.dto.ts`

- [ ] **Step 1: Extend Prisma schema**

Modify `prisma/schema.prisma` by adding the enum near the other enums:

```prisma
enum CalibrationResult {
  PASS
  NEED_RECHECK
  FAIL
}
```

Update `Team`, `Personnel`, and `CalibrationRecord` to this shape:

```prisma
model Team {
  id           String              @id @default(cuid())
  code         String              @unique
  name         String
  description  String?
  members      PersonnelTeam[]
  calibrations CalibrationRecord[]
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
}

model Personnel {
  id           String              @id @default(cuid())
  code         String              @unique
  name         String
  phone        String?
  position     String?
  teams        PersonnelTeam[]
  calibrations CalibrationRecord[]
  createdAt    DateTime            @default(now())
  updatedAt    DateTime            @updatedAt
}

model CalibrationRecord {
  id               String            @id @default(cuid())
  deviceId         String
  device           Device            @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  gasType          GasType
  beforeValue      Float
  afterValue       Float
  standardValue    Float
  calibratedBy     String
  calibratedById   String?
  calibratedByUser Personnel?        @relation(fields: [calibratedById], references: [id], onDelete: SetNull)
  teamId           String?
  team             Team?             @relation(fields: [teamId], references: [id], onDelete: SetNull)
  result           CalibrationResult @default(PASS)
  deviationPercent Float             @default(0)
  nextDueAt        DateTime          @default(now())
  notes            String?
  calibratedAt     DateTime
  createdAt        DateTime          @default(now())

  @@index([deviceId, calibratedAt])
  @@index([gasType])
  @@index([result])
  @@index([nextDueAt])
  @@index([teamId])
  @@index([calibratedById])
}
```

- [ ] **Step 2: Run Prisma generation and expect DTO compile errors**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm prisma:generate
```

Expected: Prisma Client generates successfully. API typecheck still fails until DTOs and services are updated.

- [ ] **Step 3: Update create calibration DTO**

Replace `apps/api/src/modules/calibrations/dto/create-calibration.dto.ts` with:

```ts
import { GasType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCalibrationDto {
  @IsString()
  deviceId!: string;

  @IsEnum(GasType)
  gasType!: GasType;

  @Type(() => Number)
  @IsNumber()
  beforeValue!: number;

  @Type(() => Number)
  @IsNumber()
  afterValue!: number;

  @Type(() => Number)
  @IsNumber()
  standardValue!: number;

  @IsOptional()
  @IsString()
  calibratedById?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  calibratedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  calibratedAt!: string;
}
```

- [ ] **Step 4: Create calibration query DTO**

Create `apps/api/src/modules/calibrations/dto/calibration-query.dto.ts`:

```ts
import { CalibrationResult, GasType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export enum CalibrationDueStatus {
  NORMAL = 'NORMAL',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  FAILED = 'FAILED',
}

export class CalibrationQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsEnum(GasType)
  gasType?: GasType;

  @IsOptional()
  @IsEnum(CalibrationResult)
  result?: CalibrationResult;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  calibratedById?: string;

  @IsOptional()
  @IsEnum(CalibrationDueStatus)
  dueStatus?: CalibrationDueStatus;
}
```

- [ ] **Step 5: Run focused typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api typecheck
```

Expected: Typecheck fails only because `CalibrationsService` still uses the old `result` and create shape. Continue to Task 2.

- [ ] **Step 6: Commit schema and DTO contracts**

```bash
git add prisma/schema.prisma apps/api/src/modules/calibrations/dto/create-calibration.dto.ts apps/api/src/modules/calibrations/dto/calibration-query.dto.ts
git commit -m "feat: add calibration maintenance contracts"
```

---

### Task 2: Calibration Service Result Calculation And Create Flow

**Files:**
- Create: `apps/api/src/modules/calibrations/calibrations.service.spec.ts`
- Modify: `apps/api/src/modules/calibrations/calibrations.service.ts`

- [ ] **Step 1: Write failing tests for result calculation and create audit behavior**

Create `apps/api/src/modules/calibrations/calibrations.service.spec.ts`:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalibrationResult, GasType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalibrationsService } from './calibrations.service';

describe('CalibrationsService', () => {
  const calibratedAt = new Date('2026-06-30T08:00:00.000Z');

  it('calculates pass, recheck, fail, and zero-standard results', () => {
    const service = new CalibrationsService({} as PrismaService);

    expect(service.evaluateResult(100, 108)).toEqual({ result: CalibrationResult.PASS, deviationPercent: 8 });
    expect(service.evaluateResult(100, 115)).toEqual({ result: CalibrationResult.NEED_RECHECK, deviationPercent: 15 });
    expect(service.evaluateResult(100, 130)).toEqual({ result: CalibrationResult.FAIL, deviationPercent: 30 });
    expect(service.evaluateResult(0, 0.08)).toEqual({ result: CalibrationResult.PASS, deviationPercent: 8 });
    expect(service.evaluateResult(0, 0.15)).toEqual({ result: CalibrationResult.NEED_RECHECK, deviationPercent: 15 });
    expect(service.evaluateResult(0, 0.3)).toEqual({ result: CalibrationResult.FAIL, deviationPercent: 30 });
  });

  it('creates a calibration with personnel, team, computed result, next due date, and audit logs', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cal-1', result: CalibrationResult.NEED_RECHECK });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      device: {
        findUnique: jest.fn().mockResolvedValue({ id: 'device-1', code: 'GAS-0001', name: '四合一气体检测仪 001' }),
      },
      personnel: {
        findUnique: jest.fn().mockResolvedValue({ id: 'person-1', name: '张三' }),
      },
      team: {
        findUnique: jest.fn().mockResolvedValue({ id: 'team-1', name: '甲班' }),
      },
      calibrationRecord: { create },
      auditLog: { create: auditCreate },
      $transaction: jest.fn(async (callback) => callback({
        calibrationRecord: { create },
        auditLog: { create: auditCreate },
      })),
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);

    const result = await service.create({
      deviceId: 'device-1',
      gasType: GasType.CH4,
      standardValue: 100,
      beforeValue: 93,
      afterValue: 115,
      calibratedById: 'person-1',
      teamId: 'team-1',
      calibratedAt: calibratedAt.toISOString(),
      notes: '复检一次',
    }, 'user-1');

    expect(result).toEqual({ id: 'cal-1', result: CalibrationResult.NEED_RECHECK });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: 'device-1',
        gasType: GasType.CH4,
        standardValue: 100,
        beforeValue: 93,
        afterValue: 115,
        calibratedById: 'person-1',
        teamId: 'team-1',
        calibratedBy: '张三',
        result: CalibrationResult.NEED_RECHECK,
        deviationPercent: 15,
        calibratedAt,
        nextDueAt: new Date('2026-07-30T08:00:00.000Z'),
      }),
      include: expect.any(Object),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        module: 'calibrations',
        action: 'CREATE',
        resourceId: 'cal-1',
      }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        module: 'calibrations',
        action: 'CALIBRATION_WARNING',
        resourceId: 'cal-1',
      }),
    });
  });

  it('throws when device, personnel, or team cannot be found', async () => {
    const serviceMissingDevice = new CalibrationsService({
      device: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(serviceMissingDevice.create({
      deviceId: 'missing',
      gasType: GasType.CH4,
      standardValue: 1,
      beforeValue: 1,
      afterValue: 1,
      calibratedAt: calibratedAt.toISOString(),
    })).rejects.toBeInstanceOf(NotFoundException);

    const serviceMissingPersonnel = new CalibrationsService({
      device: { findUnique: jest.fn().mockResolvedValue({ id: 'device-1' }) },
      personnel: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(serviceMissingPersonnel.create({
      deviceId: 'device-1',
      gasType: GasType.CH4,
      standardValue: 1,
      beforeValue: 1,
      afterValue: 1,
      calibratedById: 'missing-person',
      calibratedAt: calibratedAt.toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- calibrations.service.spec.ts
```

Expected: FAIL because `evaluateResult` and the new `create(dto, userId)` behavior do not exist yet.

- [ ] **Step 3: Implement service helpers and create flow**

Replace `apps/api/src/modules/calibrations/calibrations.service.ts` with this structure:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CalibrationResult, GasType, Prisma } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CalibrationDueStatus, CalibrationQueryDto } from './dto/calibration-query.dto';
import { CreateCalibrationDto } from './dto/create-calibration.dto';

export const CALIBRATION_INTERVAL_DAYS = 30;
export const CALIBRATION_DUE_SOON_DAYS = 7;
export const CALIBRATION_GAS_TYPES = [GasType.CH4, GasType.O2, GasType.CO, GasType.H2S] as const;

const calibrationInclude = {
  device: { include: { area: true, baseStation: true } },
  calibratedByUser: true,
  team: true,
} satisfies Prisma.CalibrationRecordInclude;

@Injectable()
export class CalibrationsService {
  constructor(private readonly prisma: PrismaService) {}

  evaluateResult(standardValue: number, afterValue: number) {
    const deviation = Math.abs(afterValue - standardValue);
    const deviationPercent = standardValue === 0
      ? Number((deviation * 100).toFixed(2))
      : Number(((deviation / Math.abs(standardValue)) * 100).toFixed(2));
    const score = standardValue === 0 ? deviation : deviationPercent;
    const passThreshold = standardValue === 0 ? 0.1 : 10;
    const recheckThreshold = standardValue === 0 ? 0.2 : 20;

    if (score <= passThreshold) {
      return { result: CalibrationResult.PASS, deviationPercent };
    }
    if (score <= recheckThreshold) {
      return { result: CalibrationResult.NEED_RECHECK, deviationPercent };
    }
    return { result: CalibrationResult.FAIL, deviationPercent };
  }

  nextDueAt(calibratedAt: Date) {
    const next = new Date(calibratedAt);
    next.setDate(next.getDate() + CALIBRATION_INTERVAL_DAYS);
    return next;
  }

  dueStatusFor(record: { result: CalibrationResult; nextDueAt: Date } | null, now = new Date()) {
    if (!record) return CalibrationDueStatus.OVERDUE;
    if ([CalibrationResult.FAIL, CalibrationResult.NEED_RECHECK].includes(record.result)) {
      return CalibrationDueStatus.FAILED;
    }
    if (record.nextDueAt.getTime() < now.getTime()) return CalibrationDueStatus.OVERDUE;
    const dueSoonAt = new Date(now);
    dueSoonAt.setDate(dueSoonAt.getDate() + CALIBRATION_DUE_SOON_DAYS);
    if (record.nextDueAt.getTime() <= dueSoonAt.getTime()) return CalibrationDueStatus.DUE_SOON;
    return CalibrationDueStatus.NORMAL;
  }

  async findAll(query: CalibrationQueryDto) {
    const where = this.whereForQuery(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.calibrationRecord.findMany({
        where,
        ...pagination(query),
        include: calibrationInclude,
        orderBy: { calibratedAt: 'desc' },
      }),
      this.prisma.calibrationRecord.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async create(dto: CreateCalibrationDto, userId?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    const calibratedByUser = dto.calibratedById
      ? await this.prisma.personnel.findUnique({ where: { id: dto.calibratedById } })
      : null;
    if (dto.calibratedById && !calibratedByUser) {
      throw new BadRequestException('标定人员不存在');
    }

    const team = dto.teamId ? await this.prisma.team.findUnique({ where: { id: dto.teamId } }) : null;
    if (dto.teamId && !team) {
      throw new BadRequestException('班组不存在');
    }

    const calibratedAt = new Date(dto.calibratedAt);
    const { result, deviationPercent } = this.evaluateResult(dto.standardValue, dto.afterValue);
    const nextDueAt = this.nextDueAt(calibratedAt);
    const calibratedBy = calibratedByUser?.name ?? dto.calibratedBy ?? '未填写';

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.calibrationRecord.create({
        data: {
          deviceId: dto.deviceId,
          gasType: dto.gasType,
          beforeValue: dto.beforeValue,
          afterValue: dto.afterValue,
          standardValue: dto.standardValue,
          calibratedBy,
          calibratedById: dto.calibratedById,
          teamId: dto.teamId,
          result,
          deviationPercent,
          nextDueAt,
          notes: dto.notes,
          calibratedAt,
        },
        include: calibrationInclude,
      });
      const detail = this.auditDetail(record.device?.code ?? device.code, dto.gasType, dto.standardValue, dto.afterValue, deviationPercent, result);
      await tx.auditLog.create({
        data: {
          userId,
          module: 'calibrations',
          action: 'CREATE',
          resourceId: record.id,
          detail,
        },
      });
      if (result !== CalibrationResult.PASS) {
        await tx.auditLog.create({
          data: {
            userId,
            module: 'calibrations',
            action: 'CALIBRATION_WARNING',
            resourceId: record.id,
            detail,
          },
        });
      }
      return record;
    });
  }

  private whereForQuery(query: CalibrationQueryDto): Prisma.CalibrationRecordWhereInput {
    const dueWhere = this.dueWhere(query.dueStatus);
    return {
      deviceId: query.deviceId,
      gasType: query.gasType,
      result: query.result,
      teamId: query.teamId,
      calibratedById: query.calibratedById,
      ...dueWhere,
      OR: query.keyword
        ? [
            { device: { code: { contains: query.keyword, mode: 'insensitive' } } },
            { device: { name: { contains: query.keyword, mode: 'insensitive' } } },
            { calibratedBy: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private dueWhere(dueStatus?: CalibrationDueStatus): Prisma.CalibrationRecordWhereInput {
    if (!dueStatus) return {};
    const now = new Date();
    const dueSoonAt = new Date(now);
    dueSoonAt.setDate(dueSoonAt.getDate() + CALIBRATION_DUE_SOON_DAYS);
    if (dueStatus === CalibrationDueStatus.FAILED) {
      return { result: { in: [CalibrationResult.FAIL, CalibrationResult.NEED_RECHECK] } };
    }
    if (dueStatus === CalibrationDueStatus.OVERDUE) {
      return { result: CalibrationResult.PASS, nextDueAt: { lt: now } };
    }
    if (dueStatus === CalibrationDueStatus.DUE_SOON) {
      return { result: CalibrationResult.PASS, nextDueAt: { gte: now, lte: dueSoonAt } };
    }
    return { result: CalibrationResult.PASS, nextDueAt: { gt: dueSoonAt } };
  }

  private auditDetail(deviceCode: string, gasType: GasType, standardValue: number, afterValue: number, deviationPercent: number, result: CalibrationResult) {
    return `设备 ${deviceCode} ${gasType} 标定完成：标准值 ${standardValue}，标定后 ${afterValue}，偏差 ${deviationPercent.toFixed(2)}%，结果 ${result}`;
  }
}
```

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- calibrations.service.spec.ts
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api typecheck
```

Expected: calibration service tests pass and API typecheck passes.

- [ ] **Step 5: Commit service create flow**

```bash
git add apps/api/src/modules/calibrations/calibrations.service.ts apps/api/src/modules/calibrations/calibrations.service.spec.ts
git commit -m "feat: add calibration result evaluation"
```

---

### Task 3: Calibration Overview, Due Devices, And Routes

**Files:**
- Modify: `apps/api/src/modules/calibrations/calibrations.service.spec.ts`
- Modify: `apps/api/src/modules/calibrations/calibrations.service.ts`
- Modify: `apps/api/src/modules/calibrations/calibrations.controller.ts`

- [ ] **Step 1: Add failing tests for overview and due-device aggregation**

Append to `apps/api/src/modules/calibrations/calibrations.service.spec.ts`:

```ts
  it('returns calibration overview counters', async () => {
    const dueDevices = jest.fn().mockResolvedValue([
      { dueStatus: 'DUE_SOON' },
      { dueStatus: 'OVERDUE' },
      { dueStatus: 'FAILED' },
    ]);
    const prisma = {
      calibrationRecord: {
        count: jest
          .fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4),
      },
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);
    jest.spyOn(service, 'dueDevices').mockImplementation(dueDevices);

    await expect(service.overview(new Date('2026-06-30T12:00:00.000Z'))).resolves.toEqual({
      totalRecords: 20,
      todayCompleted: 2,
      dueSoonItems: 1,
      overdueItems: 1,
      failedRecords: 3,
      needRecheckRecords: 4,
    });
  });

  it('returns due status for each device and calibration gas type', async () => {
    const now = new Date('2026-06-30T00:00:00.000Z');
    const prisma = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'device-1', code: 'GAS-0001', name: '设备1', area: { name: '一采区' }, baseStation: { name: 'BS-01' } },
        ]),
      },
      calibrationRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cal-1',
            deviceId: 'device-1',
            gasType: GasType.CH4,
            result: CalibrationResult.PASS,
            nextDueAt: new Date('2026-07-03T00:00:00.000Z'),
            calibratedAt: new Date('2026-06-03T00:00:00.000Z'),
          },
          {
            id: 'cal-2',
            deviceId: 'device-1',
            gasType: GasType.O2,
            result: CalibrationResult.FAIL,
            nextDueAt: new Date('2026-07-30T00:00:00.000Z'),
            calibratedAt: new Date('2026-06-30T00:00:00.000Z'),
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);

    const result = await service.dueDevices(now);

    expect(result).toEqual([
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.CH4, dueStatus: 'DUE_SOON' }),
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.O2, dueStatus: 'FAILED' }),
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.CO, dueStatus: 'OVERDUE' }),
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.H2S, dueStatus: 'OVERDUE' }),
    ]);
  });
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- calibrations.service.spec.ts
```

Expected: FAIL because `overview` and `dueDevices` do not exist yet.

- [ ] **Step 3: Implement overview and due-device methods**

Add these methods to `CalibrationsService`:

```ts
  async overview(now = new Date()) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const [totalRecords, todayCompleted, failedRecords, needRecheckRecords, dueItems] = await Promise.all([
      this.prisma.calibrationRecord.count(),
      this.prisma.calibrationRecord.count({ where: { calibratedAt: { gte: startOfToday } } }),
      this.prisma.calibrationRecord.count({ where: { result: CalibrationResult.FAIL } }),
      this.prisma.calibrationRecord.count({ where: { result: CalibrationResult.NEED_RECHECK } }),
      this.dueDevices(now),
    ]);

    return {
      totalRecords,
      todayCompleted,
      dueSoonItems: dueItems.filter((item) => item.dueStatus === CalibrationDueStatus.DUE_SOON).length,
      overdueItems: dueItems.filter((item) => item.dueStatus === CalibrationDueStatus.OVERDUE).length,
      failedRecords,
      needRecheckRecords,
    };
  }

  async dueDevices(now = new Date()) {
    const [devices, records] = await Promise.all([
      this.prisma.device.findMany({
        include: { area: true, baseStation: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.calibrationRecord.findMany({
        where: { gasType: { in: [...CALIBRATION_GAS_TYPES] } },
        include: calibrationInclude,
        orderBy: { calibratedAt: 'desc' },
      }),
    ]);

    const latestByDeviceGas = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      const key = `${record.deviceId}:${record.gasType}`;
      if (!latestByDeviceGas.has(key)) latestByDeviceGas.set(key, record);
    }

    return devices.flatMap((device) => CALIBRATION_GAS_TYPES.map((gasType) => {
      const latestCalibration = latestByDeviceGas.get(`${device.id}:${gasType}`) ?? null;
      return {
        deviceId: device.id,
        deviceCode: device.code,
        deviceName: device.name,
        gasType,
        areaName: device.area?.name,
        baseStationName: device.baseStation?.name,
        latestCalibration,
        nextDueAt: latestCalibration?.nextDueAt,
        dueStatus: this.dueStatusFor(latestCalibration, now),
      };
    }));
  }
```

- [ ] **Step 4: Update calibration controller routes**

Modify `apps/api/src/modules/calibrations/calibrations.controller.ts`:

```ts
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CalibrationsService } from './calibrations.service';
import { CalibrationQueryDto } from './dto/calibration-query.dto';
import { CreateCalibrationDto } from './dto/create-calibration.dto';

@ApiTags('calibrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('calibrations')
export class CalibrationsController {
  constructor(private readonly calibrationsService: CalibrationsService) {}

  @Get()
  @Permissions('calibrations:read')
  findAll(@Query() query: CalibrationQueryDto) {
    return this.calibrationsService.findAll(query);
  }

  @Get('overview')
  @Permissions('calibrations:read')
  overview() {
    return this.calibrationsService.overview();
  }

  @Get('due-devices')
  @Permissions('calibrations:read')
  dueDevices() {
    return this.calibrationsService.dueDevices();
  }

  @Post()
  @Permissions('calibrations:write')
  create(@Body() dto: CreateCalibrationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calibrationsService.create(dto, user?.id);
  }
}
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- calibrations.service.spec.ts
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api typecheck
```

Expected: calibration tests and API typecheck pass.

- [ ] **Step 6: Commit calibration overview routes**

```bash
git add apps/api/src/modules/calibrations/calibrations.service.ts apps/api/src/modules/calibrations/calibrations.service.spec.ts apps/api/src/modules/calibrations/calibrations.controller.ts
git commit -m "feat: add calibration due overview"
```

---

### Task 4: Device Calibration History API

**Files:**
- Create: `apps/api/src/modules/devices/dto/device-calibration-query.dto.ts`
- Modify: `apps/api/src/modules/devices/devices.service.spec.ts`
- Modify: `apps/api/src/modules/devices/devices.service.ts`
- Modify: `apps/api/src/modules/devices/devices.controller.ts`

- [ ] **Step 1: Create device calibration query DTO**

Create `apps/api/src/modules/devices/dto/device-calibration-query.dto.ts`:

```ts
import { GasType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class DeviceCalibrationQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(GasType)
  gasType?: GasType;
}
```

- [ ] **Step 2: Add failing device calibration history test**

Append to `apps/api/src/modules/devices/devices.service.spec.ts`:

```ts
  it('returns device calibration history with pagination and gas filter', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'cal-1' }]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      calibrationRecord: { findMany, count },
      $transaction: jest.fn(async (queries) => Promise.all(queries)),
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await expect(service.findCalibrations('device-1', { page: 1, pageSize: 5, gasType: 'CH4' as any })).resolves.toEqual({
      items: [{ id: 'cal-1' }],
      total: 1,
      page: 1,
      pageSize: 5,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { deviceId: 'device-1', gasType: 'CH4' },
      skip: 0,
      take: 5,
      orderBy: { calibratedAt: 'desc' },
      include: { calibratedByUser: true, team: true },
    });
  });
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- devices.service.spec.ts
```

Expected: FAIL because `findCalibrations` does not exist.

- [ ] **Step 4: Implement service and controller route**

Add to `DevicesService`:

```ts
  async findCalibrations(id: string, query: DeviceCalibrationQueryDto) {
    const where: Prisma.CalibrationRecordWhereInput = {
      deviceId: id,
      gasType: query.gasType,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.calibrationRecord.findMany({
        where,
        ...pagination(query),
        orderBy: { calibratedAt: 'desc' },
        include: { calibratedByUser: true, team: true },
      }),
      this.prisma.calibrationRecord.count({ where }),
    ]);
    return paginated(items, total, query);
  }
```

Update imports in `DevicesService`:

```ts
import { DeviceCalibrationQueryDto } from './dto/device-calibration-query.dto';
```

Add to `DevicesController` after `alarms`:

```ts
  @Get(':id/calibrations')
  @Permissions('devices:read')
  calibrations(@Param('id') id: string, @Query() query: DeviceCalibrationQueryDto) {
    return this.devicesService.findCalibrations(id, query);
  }
```

Update imports in `DevicesController`:

```ts
import { DeviceCalibrationQueryDto } from './dto/device-calibration-query.dto';
```

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- devices.service.spec.ts
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api typecheck
```

Expected: device service tests and API typecheck pass.

- [ ] **Step 6: Commit device calibration history API**

```bash
git add apps/api/src/modules/devices/dto/device-calibration-query.dto.ts apps/api/src/modules/devices/devices.service.spec.ts apps/api/src/modules/devices/devices.service.ts apps/api/src/modules/devices/devices.controller.ts
git commit -m "feat: add device calibration history api"
```

---

### Task 5: Seed Demo Calibration Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add calibration demo data to seed**

In `prisma/seed.ts`, add `CalibrationResult` to imports:

```ts
import { PrismaClient, AlarmSeverity, CalibrationResult, DeviceStatus, GasType, RuleOperator, SensorStatus } from '@prisma/client';
```

Add this function after `seedAlarmRules`:

```ts
async function seedCalibrationRecords() {
  const devices = await prisma.device.findMany({ take: 8, orderBy: { code: 'asc' } });
  const personnel = await prisma.personnel.findMany({ take: 4, orderBy: { code: 'asc' } });
  const teams = await prisma.team.findMany({ take: 2, orderBy: { code: 'asc' } });
  const gasTypes = [GasType.CH4, GasType.O2, GasType.CO, GasType.H2S];
  const now = new Date();

  for (const [deviceIndex, device] of devices.entries()) {
    for (const [gasIndex, gasType] of gasTypes.entries()) {
      const calibratedAt = new Date(now);
      calibratedAt.setDate(now.getDate() - ((deviceIndex + gasIndex) % 36));
      const nextDueAt = new Date(calibratedAt);
      nextDueAt.setDate(calibratedAt.getDate() + 30);
      const standardValue = gasType === GasType.O2 ? 20.9 : gasType === GasType.CH4 ? 1 : gasType === GasType.CO ? 24 : 10;
      const afterValue = deviceIndex % 5 === 0 ? standardValue * 1.24 : deviceIndex % 4 === 0 ? standardValue * 1.14 : standardValue * 1.04;
      const deviationPercent = Number((Math.abs(afterValue - standardValue) / Math.abs(standardValue) * 100).toFixed(2));
      const result = deviationPercent > 20
        ? CalibrationResult.FAIL
        : deviationPercent > 10
          ? CalibrationResult.NEED_RECHECK
          : CalibrationResult.PASS;
      const person = personnel[(deviceIndex + gasIndex) % personnel.length];
      const team = teams[(deviceIndex + gasIndex) % teams.length];

      await prisma.calibrationRecord.upsert({
        where: { id: `${device.code}-${gasType}-demo` },
        update: {
          beforeValue: standardValue * 0.95,
          afterValue,
          standardValue,
          calibratedBy: person?.name ?? '系统示例',
          calibratedById: person?.id,
          teamId: team?.id,
          result,
          deviationPercent,
          nextDueAt,
          notes: '种子演示标定记录',
          calibratedAt,
        },
        create: {
          id: `${device.code}-${gasType}-demo`,
          deviceId: device.id,
          gasType,
          beforeValue: standardValue * 0.95,
          afterValue,
          standardValue,
          calibratedBy: person?.name ?? '系统示例',
          calibratedById: person?.id,
          teamId: team?.id,
          result,
          deviationPercent,
          nextDueAt,
          notes: '种子演示标定记录',
          calibratedAt,
        },
      });
    }
  }
}
```

Call it in `main()` after `seedAlarmRules()`:

```ts
  await seedCalibrationRecords();
```

- [ ] **Step 2: Run Prisma generate and seed smoke**

Run against local Node runtime:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm prisma:generate
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api typecheck
```

Expected: Prisma generation and API typecheck pass.

- [ ] **Step 3: Commit seed data**

```bash
git add prisma/seed.ts
git commit -m "chore: seed calibration demo data"
```

---

### Task 6: Admin API Helpers

**Files:**
- Modify: `apps/admin-web/src/api/modules.ts`

- [ ] **Step 1: Add calibration API helpers**

Add to `apps/admin-web/src/api/modules.ts` after alarm helpers:

```ts
export function getCalibrationOverview() {
  return http.get('/calibrations/overview');
}

export function getCalibrationDueDevices() {
  return http.get('/calibrations/due-devices');
}

export function getDeviceCalibrations(id: string, params = {}) {
  return http.get(`/devices/${id}/calibrations`, { params });
}

export function createCalibration(data: Record<string, unknown>) {
  return http.post('/calibrations', data);
}
```

- [ ] **Step 2: Run admin typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/admin-web typecheck
```

Expected: admin typecheck passes.

- [ ] **Step 3: Commit API helpers**

```bash
git add apps/admin-web/src/api/modules.ts
git commit -m "feat: add calibration admin api helpers"
```

---

### Task 7: Calibration Workbench UI

**Files:**
- Replace: `apps/admin-web/src/views/CalibrationsView.vue`

- [ ] **Step 1: Replace the generic calibration page**

Replace `apps/admin-web/src/views/CalibrationsView.vue` with a dedicated workbench containing:

```vue
<template>
  <section class="calibration-page">
    <div class="toolbar">
      <h2 class="page-title">标定工作台</h2>
      <div class="toolbar-actions">
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增标定</el-button>
      </div>
    </div>

    <div class="metric-grid calibration-metrics">
      <div v-for="item in metricCards" :key="item.label" class="metric-card">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value" :style="{ color: item.color }">{{ item.value }}</div>
      </div>
    </div>

    <div class="panel filter-panel">
      <el-form :model="filters" inline>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="设备/标定人" style="width: 220px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item label="气体">
          <el-select v-model="filters.gasType" clearable placeholder="全部" style="width: 120px">
            <el-option v-for="item in gasOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="filters.result" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in resultOptions" :key="item" :label="resultText(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期">
          <el-select v-model="filters.dueStatus" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in dueStatusOptions" :key="item" :label="dueStatusText(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table v-loading="loading" :data="rows" class="panel calibration-table" height="540" @row-dblclick="openDetail">
      <el-table-column prop="device.code" label="设备" width="128" />
      <el-table-column prop="device.area.name" label="区域" width="120" />
      <el-table-column prop="gasType" label="气体" width="86" />
      <el-table-column prop="standardValue" label="标准值" width="96" />
      <el-table-column prop="beforeValue" label="标定前" width="96" />
      <el-table-column prop="afterValue" label="标定后" width="96" />
      <el-table-column label="偏差" width="96">
        <template #default="{ row }">{{ row.deviationPercent?.toFixed?.(2) ?? row.deviationPercent }}%</template>
      </el-table-column>
      <el-table-column label="结果" width="112">
        <template #default="{ row }">
          <el-tag :type="resultType(row.result)" effect="plain">{{ resultText(row.result) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下次标定" width="170">
        <template #default="{ row }">{{ formatTime(row.nextDueAt) }}</template>
      </el-table-column>
      <el-table-column prop="calibratedBy" label="标定人" width="120" />
      <el-table-column prop="team.name" label="班组" width="120" />
      <el-table-column label="操作" width="110" fixed="right">
        <template #default="{ row }">
          <el-button text :icon="View" @click="openDetail(row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="filters.page"
        v-model:page-size="filters.pageSize"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="createDialog" title="新增标定" width="min(620px, calc(100vw - 32px))">
      <el-form :model="form" label-position="top">
        <el-form-item label="设备"><el-select v-model="form.deviceId" filterable><el-option v-for="item in devices" :key="item.id" :label="`${item.code} ${item.name}`" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="气体"><el-select v-model="form.gasType"><el-option v-for="item in gasOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="标定人"><el-select v-model="form.calibratedById" clearable filterable><el-option v-for="item in personnel" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="班组"><el-select v-model="form.teamId" clearable><el-option v-for="item in teams" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
        <div class="number-grid">
          <el-form-item label="标准值"><el-input-number v-model="form.standardValue" :precision="2" /></el-form-item>
          <el-form-item label="标定前"><el-input-number v-model="form.beforeValue" :precision="2" /></el-form-item>
          <el-form-item label="标定后"><el-input-number v-model="form.afterValue" :precision="2" /></el-form-item>
        </div>
        <el-form-item label="标定时间"><el-date-picker v-model="form.calibratedAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.sssZ" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailDrawer" title="标定详情" size="520px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="设备">{{ detail.device?.code }} {{ detail.device?.name }}</el-descriptions-item>
        <el-descriptions-item label="气体">{{ detail.gasType }}</el-descriptions-item>
        <el-descriptions-item label="结果">{{ resultText(detail.result) }}</el-descriptions-item>
        <el-descriptions-item label="偏差">{{ detail.deviationPercent }}%</el-descriptions-item>
        <el-descriptions-item label="下次标定">{{ formatTime(detail.nextDueAt) }}</el-descriptions-item>
        <el-descriptions-item label="标定人">{{ detail.calibratedBy }}</el-descriptions-item>
        <el-descriptions-item label="班组">{{ detail.team?.name ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.notes ?? '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-drawer>
  </section>
</template>
```

Use this script body:

```ts
<script setup lang="ts">
import { Plus, Refresh, Search, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createCalibration, getCalibrationOverview, listResource } from '../api/modules';

const gasOptions = ['CH4', 'O2', 'CO', 'H2S'];
const resultOptions = ['PASS', 'NEED_RECHECK', 'FAIL'];
const dueStatusOptions = ['NORMAL', 'DUE_SOON', 'OVERDUE', 'FAILED'];
const rows = ref<any[]>([]);
const devices = ref<any[]>([]);
const personnel = ref<any[]>([]);
const teams = ref<any[]>([]);
const overview = ref<any>({});
const detail = ref<any>(null);
const total = ref(0);
const loading = ref(false);
const submitting = ref(false);
const createDialog = ref(false);
const detailDrawer = ref(false);

const filters = reactive({ keyword: '', gasType: '', result: '', dueStatus: '', page: 1, pageSize: 20 });
const form = reactive({
  deviceId: '',
  gasType: 'CH4',
  calibratedById: '',
  teamId: '',
  standardValue: 1,
  beforeValue: 1,
  afterValue: 1,
  calibratedAt: new Date().toISOString(),
  notes: '',
});

const metricCards = computed(() => [
  { label: '标定记录', value: overview.value.totalRecords ?? 0, color: '#1d4ed8' },
  { label: '今日完成', value: overview.value.todayCompleted ?? 0, color: '#16a34a' },
  { label: '即将到期', value: overview.value.dueSoonItems ?? 0, color: '#ca8a04' },
  { label: '已超期', value: overview.value.overdueItems ?? 0, color: '#dc2626' },
  { label: '需复检', value: overview.value.needRecheckRecords ?? 0, color: '#ea580c' },
  { label: '失败', value: overview.value.failedRecords ?? 0, color: '#b91c1c' },
]);

function params() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined));
}

async function load() {
  loading.value = true;
  try {
    const [listResult, overviewResult]: any[] = await Promise.all([
      listResource('/calibrations', params()),
      getCalibrationOverview(),
    ]);
    rows.value = listResult.items ?? listResult;
    total.value = listResult.total ?? rows.value.length;
    overview.value = overviewResult;
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  const [deviceResult, personnelResult, teamResult]: any[] = await Promise.all([
    listResource('/devices', { pageSize: 200 }),
    listResource('/personnel', { pageSize: 200 }),
    listResource('/teams', { pageSize: 200 }),
  ]);
  devices.value = deviceResult.items ?? deviceResult;
  personnel.value = personnelResult.items ?? personnelResult;
  teams.value = teamResult.items ?? teamResult;
}

function search() {
  filters.page = 1;
  void load();
}

function resetFilters() {
  filters.keyword = '';
  filters.gasType = '';
  filters.result = '';
  filters.dueStatus = '';
  search();
}

function handleSizeChange() {
  filters.page = 1;
  void load();
}

function openCreate() {
  Object.assign(form, { deviceId: '', gasType: 'CH4', calibratedById: '', teamId: '', standardValue: 1, beforeValue: 1, afterValue: 1, calibratedAt: new Date().toISOString(), notes: '' });
  createDialog.value = true;
}

function openDetail(row: any) {
  detail.value = row;
  detailDrawer.value = true;
}

async function submit() {
  submitting.value = true;
  try {
    const result: any = await createCalibration(form);
    createDialog.value = false;
    ElMessage.success(result.result === 'PASS' ? '标定记录已创建' : `标定记录已创建：${resultText(result.result)}`);
    await load();
  } finally {
    submitting.value = false;
  }
}

function resultText(result: string) {
  return ({ PASS: '合格', NEED_RECHECK: '需复检', FAIL: '失败' } as Record<string, string>)[result] ?? result;
}

function resultType(result: string) {
  return ({ PASS: 'success', NEED_RECHECK: 'warning', FAIL: 'danger' } as Record<string, string>)[result] ?? 'info';
}

function dueStatusText(status: string) {
  return ({ NORMAL: '正常', DUE_SOON: '即将到期', OVERDUE: '已超期', FAILED: '异常' } as Record<string, string>)[status] ?? status;
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

onMounted(async () => {
  await loadOptions();
  await load();
});
</script>
```

Use this scoped style:

```css
<style scoped>
.toolbar-actions {
  display: flex;
  gap: 10px;
}

.calibration-metrics {
  grid-template-columns: repeat(6, minmax(120px, 1fr));
}

.filter-panel {
  margin-bottom: 14px;
}

.calibration-table {
  padding: 0;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 1100px) {
  .calibration-metrics,
  .number-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

- [ ] **Step 2: Run admin typecheck and build**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/admin-web typecheck
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/admin-web build
```

Expected: admin typecheck and build pass. Vite may emit the existing large chunk warning.

- [ ] **Step 3: Commit calibration workbench UI**

```bash
git add apps/admin-web/src/views/CalibrationsView.vue
git commit -m "feat: add calibration workbench"
```

---

### Task 8: Device Drawer Calibration History UI

**Files:**
- Modify: `apps/admin-web/src/views/DevicesView.vue`

- [ ] **Step 1: Add calibration history state and helper import**

In `apps/admin-web/src/views/DevicesView.vue`, update imports:

```ts
import { createResource, getDeviceCalibrations, listResource, updateResource } from '../api/modules';
```

Add state:

```ts
const calibrationRows = ref<any[]>([]);
```

Add loader:

```ts
async function loadCalibrations(id: string) {
  const result: any = await getDeviceCalibrations(id, { pageSize: 5 });
  calibrationRows.value = result.items ?? result;
}
```

Update `openCreate`:

```ts
calibrationRows.value = [];
```

Update `openEdit`:

```ts
void loadCalibrations(row.id);
```

- [ ] **Step 2: Add history table to drawer**

Inside the drawer after the device form and before the save button, add:

```vue
      <div v-if="editingId" class="device-calibrations">
        <h3>最近标定</h3>
        <el-table :data="calibrationRows" size="small" height="220">
          <el-table-column prop="gasType" label="气体" width="70" />
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <el-tag :type="row.result === 'PASS' ? 'success' : row.result === 'NEED_RECHECK' ? 'warning' : 'danger'" effect="plain">
                {{ row.result === 'PASS' ? '合格' : row.result === 'NEED_RECHECK' ? '需复检' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="偏差" width="80">
            <template #default="{ row }">{{ row.deviationPercent }}%</template>
          </el-table-column>
          <el-table-column prop="calibratedBy" label="标定人" width="100" />
          <el-table-column label="时间" min-width="150">
            <template #default="{ row }">{{ row.calibratedAt ? new Date(row.calibratedAt).toLocaleString('zh-CN', { hour12: false }) : '-' }}</template>
          </el-table-column>
        </el-table>
      </div>
```

Add scoped style:

```vue
<style scoped>
.device-calibrations {
  margin: 18px 0;
}

.device-calibrations h3 {
  margin: 0 0 10px;
  font-size: 15px;
}
</style>
```

- [ ] **Step 3: Run admin typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/admin-web typecheck
```

Expected: admin typecheck passes.

- [ ] **Step 4: Commit device drawer history**

```bash
git add apps/admin-web/src/views/DevicesView.vue
git commit -m "feat: show device calibration history"
```

---

### Task 9: Full Verification And Docker Smoke

**Files:**
- No planned source edits.

- [ ] **Step 1: Run full local verification**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm prisma:generate
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm -r typecheck
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm -r test
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm -r build
```

Expected:

- Prisma Client generation succeeds.
- All workspace typechecks pass.
- API tests include the new calibration and device calibration tests.
- Build passes with only existing Vite chunk-size warnings.

- [ ] **Step 2: Run Docker Compose one-command startup**

Run:

```bash
./scripts/docker-up.sh
```

Expected:

- `gas-detection-api`, `gas-detection-admin-web`, `gas-detection-screen-web`, `gas-detection-simulator`, `postgres`, `redis`, and `mosquitto` are running.
- API logs show `/api/v1/calibrations/overview`, `/api/v1/calibrations/due-devices`, and `/api/v1/devices/:id/calibrations` routes mapped.

- [ ] **Step 3: Smoke test calibration endpoints**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node - <<'NODE'
const base = 'http://localhost:3000/api/v1';
const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
});
const loginBody = await login.json();
const token = loginBody?.data?.data?.accessToken ?? loginBody?.data?.accessToken;
console.log('login', login.status, Boolean(token));

const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const devices = await (await fetch(`${base}/devices?pageSize=1`, { headers })).json();
const deviceId = (devices?.data?.data?.items ?? devices?.data?.items ?? [])[0]?.id;

const overview = await fetch(`${base}/calibrations/overview`, { headers });
console.log('overview', overview.status);

const due = await fetch(`${base}/calibrations/due-devices`, { headers });
console.log('due-devices', due.status);

const history = await fetch(`${base}/devices/${deviceId}/calibrations?pageSize=5`, { headers });
console.log('device-calibrations', history.status);

const create = await fetch(`${base}/calibrations`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    deviceId,
    gasType: 'CH4',
    beforeValue: 0.9,
    afterValue: 1.08,
    standardValue: 1,
    calibratedBy: '接口冒烟',
    calibratedAt: new Date().toISOString(),
    notes: 'smoke test',
  }),
});
const createBody = await create.json();
console.log('create', create.status, createBody?.data?.data?.result ?? createBody?.data?.result);
NODE
```

Expected:

- `login 201 true`
- `overview 200`
- `due-devices 200`
- `device-calibrations 200`
- `create 201 PASS`

- [ ] **Step 4: Check browser routes manually**

Open:

- Admin: `http://localhost:8080`
- Swagger: `http://localhost:3000/api/docs`

Login with:

- Username: `admin`
- Password: `admin123456`

Verify:

- 标定工作台 shows metric cards and records.
- 新增标定 creates a record and displays the computed result.
- 设备管理 drawer shows 最近标定 for an existing device.
- 操作日志 shows `calibrations` entries after creating a record.

- [ ] **Step 5: Keep documentation unchanged**

No README or API example update is part of this task. Record any mismatch in the implementation handoff instead of expanding this feature branch's scope.

- [ ] **Step 6: Push branch**

Run:

```bash
git push
```

Expected: branch `codex/alarm-closure-workflow` pushes to GitHub.

---

## Review Checklist

- Schema has `CalibrationResult`, personnel/team links, `deviationPercent`, and `nextDueAt`.
- `POST /calibrations` computes result server-side and writes audit logs.
- `GET /calibrations/overview` and `GET /calibrations/due-devices` return stable JSON.
- `GET /devices/:id/calibrations` returns paginated device history.
- Admin calibration page is a real workbench, not `SimpleResourceView`.
- Device drawer shows recent calibration records.
- No real hardware command or external notification is introduced.
- `pnpm prisma:generate`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`, and `./scripts/docker-up.sh` pass.
