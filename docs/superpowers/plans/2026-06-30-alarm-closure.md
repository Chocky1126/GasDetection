# Alarm Closure Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete alarm closure workflow with remarks, action timeline, statistics, automatic escalation, admin console interactions, and screen risk updates.

**Architecture:** Extend the existing `AlarmEvent`/`AlarmActionLog` model instead of introducing a second workflow table. Keep REST changes inside `apps/api/src/modules/alarms`, reuse `RealtimeGateway` for live refresh, and update the existing Vue alarm center and data screen components with focused changes.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Socket.IO WebSocket, Vue 3, Element Plus, ECharts, pnpm, Docker Compose.

---

## File Map

- Modify `prisma/schema.prisma`: add alarm closure and escalation fields.
- Modify `apps/api/src/modules/alarms/dto/alarm-query.dto.ts`: keep list filters and ensure query typing is compatible with statistics work.
- Create `apps/api/src/modules/alarms/dto/alarm-action.dto.ts`: request body for ack/resolve remarks.
- Modify `apps/api/src/modules/alarms/alarms.service.ts`: validate state transitions, persist remarks, include action users, calculate statistics.
- Modify `apps/api/src/modules/alarms/alarms.controller.ts`: add body DTOs and statistics route.
- Create `apps/api/src/modules/alarms/alarm-escalation.service.ts`: scan active alarms and escalate overdue alarms.
- Modify `apps/api/src/modules/alarms/alarms.module.ts`: register escalation service.
- Modify `apps/api/src/modules/monitor/monitor.service.ts`: include escalated alarm weight in area risk ranking.
- Modify `apps/api/src/modules/alarms/alarms.service.spec.ts`: cover remarks, invalid transitions, statistics.
- Create `apps/api/src/modules/alarms/alarm-escalation.service.spec.ts`: cover automatic escalation.
- Modify `apps/admin-web/src/api/modules.ts`: add alarm statistics/detail helpers and remark payloads.
- Replace most of `apps/admin-web/src/views/AlarmsView.vue`: filters, statistics cards, remark dialogs, detail drawer.
- Modify `apps/screen-web/src/components/RealtimeAlarms.vue`: show escalation marker.
- Modify `apps/screen-web/src/components/AreaRiskRanking.vue`: show escalated count if returned.
- Modify `docs/superpowers/specs/2026-06-30-alarm-closure-design.md` only if implementation reveals a necessary wording correction.

---

### Task 1: Database And API Contracts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `apps/api/src/modules/alarms/dto/alarm-action.dto.ts`
- Modify: `apps/api/src/modules/alarms/alarms.controller.ts`

- [ ] **Step 1: Extend the Prisma model**

Add the fields below to `model AlarmEvent` after `resolvedAt`:

```prisma
  ackRemark       String?
  resolveRemark   String?
  escalatedAt     DateTime?
  escalationLevel Int              @default(0)
```

Add this index near the existing `AlarmEvent` indexes:

```prisma
  @@index([status, escalationLevel])
```

- [ ] **Step 2: Regenerate Prisma client**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm prisma:generate
```

Expected: Prisma Client generation succeeds and `@prisma/client` exposes the new fields.

- [ ] **Step 3: Add the action body DTO**

Create `apps/api/src/modules/alarms/dto/alarm-action.dto.ts`:

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AlarmActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
```

- [ ] **Step 4: Update controller method signatures**

Change `apps/api/src/modules/alarms/alarms.controller.ts` imports:

```ts
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AlarmActionDto } from './dto/alarm-action.dto';
```

Add the statistics route before `@Get(':id')` so `statistics` is not treated as an id:

```ts
  @Get('statistics')
  @Permissions('alarms:read')
  statistics() {
    return this.alarmsService.statistics();
  }
```

Change ack/resolve:

```ts
  @Patch(':id/ack')
  @Permissions('alarms:write')
  ack(@Param('id') id: string, @Body() body: AlarmActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alarmsService.ack(id, user?.id, body.remark);
  }

  @Patch(':id/resolve')
  @Permissions('alarms:write')
  resolve(@Param('id') id: string, @Body() body: AlarmActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.alarmsService.resolve(id, user?.id, body.remark);
  }
```

- [ ] **Step 5: Verify contract compile failure before service implementation**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api typecheck
```

Expected before Task 2: TypeScript fails because `AlarmsService.statistics`, `ack(id,user,remark)`, and `resolve(id,user,remark)` are not implemented.

---

### Task 2: Alarm Service Closure Behavior

**Files:**
- Modify: `apps/api/src/modules/alarms/alarms.service.spec.ts`
- Modify: `apps/api/src/modules/alarms/alarms.service.ts`

- [ ] **Step 1: Replace service tests with closure cases**

Update `apps/api/src/modules/alarms/alarms.service.spec.ts` with these tests:

```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlarmSeverity, AlarmStatus, GasType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmsService } from './alarms.service';

function serviceWithTransaction(tx: Record<string, unknown>) {
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(tx)),
  } as unknown as PrismaService;
  return new AlarmsService(prisma);
}

describe('AlarmsService', () => {
  it('acknowledges an active alarm with a remark and records an action', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACTIVE, ackedAt: null });
    const update = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED, ackRemark: '已通知巡检' });
    const create = jest.fn().mockResolvedValue({ id: 'action-1' });
    const service = serviceWithTransaction({
      alarmEvent: { findUnique, update },
      alarmActionLog: { create },
    });

    const result = await service.ack('alarm-1', 'user-1', '已通知巡检');

    expect(result.status).toBe(AlarmStatus.ACKED);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        status: AlarmStatus.ACKED,
        ackedAt: expect.any(Date),
        ackRemark: '已通知巡检',
      }),
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: 'user-1',
        action: 'ACK',
        remark: '已通知巡检',
      },
    });
  });

  it('rejects acknowledging a resolved alarm', async () => {
    const service = serviceWithTransaction({
      alarmEvent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.RESOLVED }),
      },
      alarmActionLog: { create: jest.fn() },
    });

    await expect(service.ack('alarm-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws not found when alarm does not exist', async () => {
    const service = serviceWithTransaction({
      alarmEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      alarmActionLog: { create: jest.fn() },
    });

    await expect(service.resolve('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves an active alarm with a remark and records an action', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACTIVE });
    const update = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.RESOLVED, resolveRemark: '现场复测正常' });
    const create = jest.fn().mockResolvedValue({ id: 'action-1' });
    const service = serviceWithTransaction({
      alarmEvent: { findUnique, update },
      alarmActionLog: { create },
    });

    const result = await service.resolve('alarm-1', 'user-1', '现场复测正常');

    expect(result.status).toBe(AlarmStatus.RESOLVED);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        status: AlarmStatus.RESOLVED,
        resolvedAt: expect.any(Date),
        resolveRemark: '现场复测正常',
      }),
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: 'user-1',
        action: 'RESOLVE',
        remark: '现场复测正常',
      },
    });
  });

  it('returns statistics by status, severity, gas type, escalation, and latest active alarms', async () => {
    const prisma = {
      alarmEvent: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([{ status: AlarmStatus.ACTIVE, _count: { status: 3 } }])
          .mockResolvedValueOnce([{ severity: AlarmSeverity.HIGH, _count: { severity: 2 } }])
          .mockResolvedValueOnce([{ gasType: GasType.CH4, _count: { gasType: 4 } }]),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: 'alarm-1' }]),
      },
    } as unknown as PrismaService;
    const service = new AlarmsService(prisma);

    const result = await service.statistics();

    expect(result.byStatus.ACTIVE).toBe(3);
    expect(result.bySeverity.HIGH).toBe(2);
    expect(result.byGasType.CH4).toBe(4);
    expect(result.escalatedActive).toBe(1);
    expect(result.latestActive).toEqual([{ id: 'alarm-1' }]);
  });
});
```

- [ ] **Step 2: Run the alarm service tests to verify failure**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- alarms.service.spec.ts
```

Expected: tests fail because `AlarmsService` has no remark validation, transition validation, or statistics method yet.

- [ ] **Step 3: Implement service behavior**

Update `apps/api/src/modules/alarms/alarms.service.ts` with these imports:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlarmSeverity, AlarmStatus, GasType, Prisma } from '@prisma/client';
```

Add helpers inside the class:

```ts
  private normalizeRemark(remark?: string) {
    const trimmed = remark?.trim();
    return trimmed ? trimmed : undefined;
  }

  private async requireAlarm(tx: Prisma.TransactionClient, id: string) {
    const alarm = await tx.alarmEvent.findUnique({ where: { id } });
    if (!alarm) {
      throw new NotFoundException('报警不存在');
    }
    return alarm;
  }

  private zeroStatusMap() {
    return { ACTIVE: 0, ACKED: 0, RESOLVED: 0 } as Record<AlarmStatus, number>;
  }

  private zeroSeverityMap() {
    return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<AlarmSeverity, number>;
  }

  private zeroGasTypeMap() {
    return { CH4: 0, O2: 0, CO: 0, H2S: 0, BATTERY: 0 } as Record<GasType, number>;
  }
```

Change `findOne` include:

```ts
  findOne(id: string) {
    return this.prisma.alarmEvent.findUnique({
      where: { id },
      include: {
        device: { include: { area: true, baseStation: true } },
        rule: true,
        actions: {
          include: { user: { select: { id: true, username: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }
```

Replace `ack`:

```ts
  async ack(id: string, userId?: string, remark?: string) {
    const normalizedRemark = this.normalizeRemark(remark);
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.requireAlarm(tx, id);
      if (existing.status === AlarmStatus.RESOLVED) {
        throw new BadRequestException('已解除报警不能再次确认');
      }
      const alarm = await tx.alarmEvent.update({
        where: { id },
        data: {
          status: AlarmStatus.ACKED,
          ackedAt: existing.ackedAt ?? new Date(),
          ackRemark: normalizedRemark,
        },
      });
      await tx.alarmActionLog.create({
        data: {
          alarmId: id,
          userId,
          action: 'ACK',
          remark: normalizedRemark,
        },
      });
      return alarm;
    });
  }
```

Replace `resolve`:

```ts
  async resolve(id: string, userId?: string, remark?: string) {
    const normalizedRemark = this.normalizeRemark(remark);
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.requireAlarm(tx, id);
      if (existing.status === AlarmStatus.RESOLVED) {
        throw new BadRequestException('报警已解除');
      }
      const alarm = await tx.alarmEvent.update({
        where: { id },
        data: {
          status: AlarmStatus.RESOLVED,
          resolvedAt: new Date(),
          resolveRemark: normalizedRemark,
        },
      });
      await tx.alarmActionLog.create({
        data: {
          alarmId: id,
          userId,
          action: 'RESOLVE',
          remark: normalizedRemark,
        },
      });
      return alarm;
    });
  }
```

Add `statistics`:

```ts
  async statistics() {
    const [byStatusGroups, bySeverityGroups, byGasTypeGroups, escalatedActive, latestActive] = await Promise.all([
      this.prisma.alarmEvent.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.alarmEvent.groupBy({ by: ['severity'], _count: { severity: true } }),
      this.prisma.alarmEvent.groupBy({ by: ['gasType'], _count: { gasType: true } }),
      this.prisma.alarmEvent.count({
        where: {
          status: AlarmStatus.ACTIVE,
          escalationLevel: { gt: 0 },
        },
      }),
      this.prisma.alarmEvent.findMany({
        where: { status: AlarmStatus.ACTIVE },
        take: 10,
        include: { device: true, rule: true },
        orderBy: [{ escalationLevel: 'desc' }, { startedAt: 'desc' }],
      }),
    ]);

    const byStatus = this.zeroStatusMap();
    for (const item of byStatusGroups) byStatus[item.status] = item._count.status;

    const bySeverity = this.zeroSeverityMap();
    for (const item of bySeverityGroups) bySeverity[item.severity] = item._count.severity;

    const byGasType = this.zeroGasTypeMap();
    for (const item of byGasTypeGroups) byGasType[item.gasType] = item._count.gasType;

    return { byStatus, bySeverity, byGasType, escalatedActive, latestActive };
  }
```

- [ ] **Step 4: Run the focused service test**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- alarms.service.spec.ts
```

Expected: `AlarmsService` tests pass.

---

### Task 3: Automatic Escalation And Realtime Updates

**Files:**
- Create: `apps/api/src/modules/alarms/alarm-escalation.service.ts`
- Create: `apps/api/src/modules/alarms/alarm-escalation.service.spec.ts`
- Modify: `apps/api/src/modules/alarms/alarms.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/modules/monitor/monitor.service.ts`

- [ ] **Step 1: Add schedule dependency**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api add @nestjs/schedule@^4.1.2
```

Expected: `apps/api/package.json` and `pnpm-lock.yaml` update.

- [ ] **Step 2: Register ScheduleModule**

In `apps/api/src/app.module.ts`, import and register:

```ts
import { ScheduleModule } from '@nestjs/schedule';
```

Add to module imports:

```ts
ScheduleModule.forRoot(),
```

- [ ] **Step 3: Add escalation tests**

Create `apps/api/src/modules/alarms/alarm-escalation.service.spec.ts`:

```ts
import { AlarmSeverity, AlarmStatus, GasType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AlarmEscalationService } from './alarm-escalation.service';

describe('AlarmEscalationService', () => {
  it('escalates overdue active alarms once and emits alarm.updated', async () => {
    const overdueAlarm = {
      id: 'alarm-1',
      ruleId: 'rule-1',
      status: AlarmStatus.ACTIVE,
      severity: AlarmSeverity.HIGH,
      escalationLevel: 0,
      startedAt: new Date(Date.now() - 600_000),
      rule: { durationSeconds: 60 },
    };
    const update = jest.fn().mockResolvedValue({
      ...overdueAlarm,
      severity: AlarmSeverity.CRITICAL,
      escalationLevel: 1,
      escalatedAt: new Date(),
      actions: [{ action: 'ESCALATE' }],
    });
    const prisma = {
      alarmEvent: {
        findMany: jest.fn().mockResolvedValue([overdueAlarm]),
        update,
      },
      alarmActionLog: {
        create: jest.fn().mockResolvedValue({ id: 'action-1' }),
      },
    } as unknown as PrismaService;
    const gateway = { emitAlarmUpdated: jest.fn(), emitScreenOverviewUpdated: jest.fn() } as unknown as RealtimeGateway;
    const service = new AlarmEscalationService(prisma, gateway);

    const result = await service.scanAndEscalate();

    expect(result.escalated).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        severity: AlarmSeverity.CRITICAL,
        escalationLevel: 1,
        escalatedAt: expect.any(Date),
      }),
      include: expect.any(Object),
    });
    expect(gateway.emitAlarmUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 'alarm-1', escalationLevel: 1 }));
  });

  it('keeps critical severity at critical', () => {
    const service = new AlarmEscalationService({} as PrismaService, {} as RealtimeGateway);
    expect(service.nextSeverity(AlarmSeverity.CRITICAL)).toBe(AlarmSeverity.CRITICAL);
  });

  it('uses five minutes when rule duration is zero', () => {
    const service = new AlarmEscalationService({} as PrismaService, {} as RealtimeGateway);
    expect(service.escalationDeadlineSeconds({ rule: { durationSeconds: 0 } })).toBe(300);
  });
});
```

- [ ] **Step 4: Implement escalation service**

Create `apps/api/src/modules/alarms/alarm-escalation.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AlarmEvent, AlarmSeverity, AlarmStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type EscalationCandidate = AlarmEvent & {
  rule: { durationSeconds: number } | null;
};

@Injectable()
export class AlarmEscalationService {
  private readonly logger = new Logger(AlarmEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  @Interval(60_000)
  async handleInterval() {
    try {
      await this.scanAndEscalate();
    } catch (error) {
      this.logger.error(`Alarm escalation scan failed: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  async scanAndEscalate(now = new Date()) {
    const candidates = await this.prisma.alarmEvent.findMany({
      where: {
        status: AlarmStatus.ACTIVE,
        escalationLevel: 0,
      },
      include: { rule: { select: { durationSeconds: true } } },
    });

    let escalated = 0;
    for (const alarm of candidates) {
      const deadlineMs = this.escalationDeadlineSeconds(alarm) * 1000;
      if (now.getTime() - alarm.startedAt.getTime() < deadlineMs) {
        continue;
      }

      const nextSeverity = this.nextSeverity(alarm.severity);
      const escalatedAt = now;
      const updated = await this.prisma.alarmEvent.update({
        where: { id: alarm.id },
        data: {
          severity: nextSeverity,
          escalationLevel: 1,
          escalatedAt,
        },
        include: {
          device: true,
          rule: true,
          actions: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      await this.prisma.alarmActionLog.create({
        data: {
          alarmId: alarm.id,
          action: 'ESCALATE',
          remark: `报警超过 ${this.escalationDeadlineSeconds(alarm)} 秒未确认，自动升级`,
        },
      });
      this.realtimeGateway.emitAlarmUpdated({
        id: updated.id,
        status: updated.status,
        severity: updated.severity,
        escalationLevel: updated.escalationLevel,
        escalatedAt: updated.escalatedAt,
        ackedAt: updated.ackedAt,
        resolvedAt: updated.resolvedAt,
        latestAction: 'ESCALATE',
      });
      escalated += 1;
    }

    if (escalated > 0) {
      this.realtimeGateway.emitScreenOverviewUpdated({ escalated });
    }

    return { scanned: candidates.length, escalated };
  }

  escalationDeadlineSeconds(alarm: Pick<EscalationCandidate, 'rule'>) {
    const configured = alarm.rule?.durationSeconds ?? 0;
    return configured > 0 ? configured : 300;
  }

  nextSeverity(severity: AlarmSeverity) {
    const order = [AlarmSeverity.LOW, AlarmSeverity.MEDIUM, AlarmSeverity.HIGH, AlarmSeverity.CRITICAL];
    const index = order.indexOf(severity);
    return order[Math.min(index + 1, order.length - 1)];
  }
}
```

- [ ] **Step 5: Register escalation provider**

Update `apps/api/src/modules/alarms/alarms.module.ts`:

```ts
import { AlarmEscalationService } from './alarm-escalation.service';

@Module({
  controllers: [AlarmsController],
  providers: [AlarmsService, AlarmEvaluatorService, AlarmEscalationService],
  exports: [AlarmsService, AlarmEvaluatorService, AlarmEscalationService],
})
export class AlarmsModule {}
```

- [ ] **Step 6: Increase area risk for escalated alarms**

In `apps/api/src/modules/monitor/monitor.service.ts`, change `getAreaRiskRanking()` mapping:

```ts
        const activeAlarms = area.devices.reduce((sum, device) => sum + device.alarms.length, 0);
        const escalatedAlarms = area.devices.reduce(
          (sum, device) => sum + device.alarms.filter((alarm) => alarm.escalationLevel > 0).length,
          0,
        );
        const faultDevices = area.devices.filter((device) => device.snapshot?.status === DeviceStatus.FAULT).length;
        const lowBatteryDevices = area.devices.filter((device) => (device.snapshot?.batteryLevel ?? 100) < 20).length;
        return {
          areaId: area.id,
          areaName: area.name,
          activeAlarms,
          escalatedAlarms,
          faultDevices,
          lowBatteryDevices,
          riskScore: activeAlarms * 10 + escalatedAlarms * 8 + faultDevices * 5 + lowBatteryDevices * 2 + area.riskLevel,
        };
```

- [ ] **Step 7: Run focused escalation tests**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/api test -- alarm-escalation.service.spec.ts
```

Expected: escalation service tests pass.

---

### Task 4: Admin Alarm Center

**Files:**
- Modify: `apps/admin-web/src/api/modules.ts`
- Modify: `apps/admin-web/src/views/AlarmsView.vue`

- [ ] **Step 1: Update API helpers**

In `apps/admin-web/src/api/modules.ts`, replace alarm helper functions:

```ts
export function getAlarms(params = {}) {
  return http.get('/alarms', { params });
}

export function getAlarm(id: string) {
  return http.get(`/alarms/${id}`);
}

export function getAlarmStatistics() {
  return http.get('/alarms/statistics');
}

export function ackAlarm(id: string, data: { remark?: string } = {}) {
  return http.patch(`/alarms/${id}/ack`, data);
}

export function resolveAlarm(id: string, data: { remark?: string } = {}) {
  return http.patch(`/alarms/${id}/resolve`, data);
}
```

- [ ] **Step 2: Replace alarm view script setup state**

In `apps/admin-web/src/views/AlarmsView.vue`, use these imports and state:

```ts
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref, watch } from 'vue';
import { ackAlarm, getAlarm, getAlarms, getAlarmStatistics, resolveAlarm } from '../api/modules';
import { useRealtimeStore } from '../stores/realtime';

const realtime = useRealtimeStore();
const rows = ref<any[]>([]);
const statistics = ref<any>({});
const detail = ref<any>(null);
const detailDrawer = ref(false);
const actionDialog = ref(false);
const actionType = ref<'ACK' | 'RESOLVE'>('ACK');
const activeAlarm = ref<any>(null);
const actionForm = reactive({ remark: '' });
const filters = reactive({ status: '', severity: '', gasType: '', keyword: '' });
const statuses = ['ACTIVE', 'ACKED', 'RESOLVED'];
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const gasTypes = ['CH4', 'O2', 'CO', 'H2S', 'BATTERY'];
```

- [ ] **Step 3: Add alarm view methods**

In the same script, add:

```ts
async function load() {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const [alarmResult, statisticsResult]: any[] = await Promise.all([
    getAlarms({ ...params, pageSize: 100 }),
    getAlarmStatistics(),
  ]);
  rows.value = alarmResult.items ?? alarmResult;
  statistics.value = statisticsResult;
}

async function openDetail(row: any) {
  detail.value = await getAlarm(row.id);
  detailDrawer.value = true;
}

function openAction(row: any, type: 'ACK' | 'RESOLVE') {
  activeAlarm.value = row;
  actionType.value = type;
  actionForm.remark = '';
  actionDialog.value = true;
}

async function submitAction() {
  if (!activeAlarm.value) return;
  if (actionType.value === 'ACK') {
    await ackAlarm(activeAlarm.value.id, { remark: actionForm.remark });
    ElMessage.success('报警已确认');
  } else {
    await resolveAlarm(activeAlarm.value.id, { remark: actionForm.remark });
    ElMessage.success('报警已解除');
  }
  actionDialog.value = false;
  await load();
}

function severityType(severity: string) {
  if (severity === 'CRITICAL') return 'danger';
  if (severity === 'HIGH') return 'warning';
  if (severity === 'MEDIUM') return 'primary';
  return 'info';
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

watch(() => realtime.latestAlarm, () => load());
onMounted(load);
```

- [ ] **Step 4: Replace template with statistics, filters, table, dialog, drawer**

Use this structure in `AlarmsView.vue`:

```vue
<template>
  <section>
    <div class="toolbar">
      <h2 class="page-title">报警中心</h2>
      <el-button @click="load">刷新</el-button>
    </div>

    <div class="metric-grid">
      <div class="metric-card"><span>活动报警</span><strong>{{ statistics.byStatus?.ACTIVE ?? 0 }}</strong></div>
      <div class="metric-card"><span>已确认</span><strong>{{ statistics.byStatus?.ACKED ?? 0 }}</strong></div>
      <div class="metric-card"><span>已解除</span><strong>{{ statistics.byStatus?.RESOLVED ?? 0 }}</strong></div>
      <div class="metric-card"><span>升级中</span><strong>{{ statistics.escalatedActive ?? 0 }}</strong></div>
    </div>

    <div class="panel filter-bar">
      <el-select v-model="filters.status" clearable placeholder="状态">
        <el-option v-for="item in statuses" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-model="filters.severity" clearable placeholder="等级">
        <el-option v-for="item in severities" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-model="filters.gasType" clearable placeholder="类型">
        <el-option v-for="item in gasTypes" :key="item" :label="item" :value="item" />
      </el-select>
      <el-input v-model="filters.keyword" clearable placeholder="设备/内容" />
      <el-button type="primary" @click="load">查询</el-button>
    </div>

    <el-table :data="rows" class="panel" height="620">
      <el-table-column prop="device.code" label="设备" width="120" />
      <el-table-column prop="gasType" label="类型" width="90" />
      <el-table-column label="等级" width="110">
        <template #default="{ row }"><el-tag :type="severityType(row.severity)">{{ row.severity }}</el-tag></template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ row.status }}</template>
      </el-table-column>
      <el-table-column label="升级" width="80">
        <template #default="{ row }"><el-tag v-if="row.escalationLevel > 0" type="danger">已升级</el-tag><span v-else>-</span></template>
      </el-table-column>
      <el-table-column prop="value" label="当前值" width="100" />
      <el-table-column prop="thresholdValue" label="阈值" width="100" />
      <el-table-column prop="message" label="内容" min-width="260" />
      <el-table-column label="开始时间" width="180">
        <template #default="{ row }">{{ formatTime(row.startedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button text @click="openDetail(row)">详情</el-button>
          <el-button text :disabled="row.status === 'RESOLVED'" @click="openAction(row, 'ACK')">确认</el-button>
          <el-button text :disabled="row.status === 'RESOLVED'" @click="openAction(row, 'RESOLVE')">解除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="actionDialog" :title="actionType === 'ACK' ? '确认报警' : '解除报警'" width="420px">
      <el-form label-position="top">
        <el-form-item label="处置说明">
          <el-input v-model="actionForm.remark" type="textarea" maxlength="500" show-word-limit :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actionDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAction">提交</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailDrawer" title="报警详情" size="520px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="设备">{{ detail.device?.code }} {{ detail.device?.name }}</el-descriptions-item>
        <el-descriptions-item label="区域">{{ detail.device?.area?.name ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="规则">{{ detail.rule?.name ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="报警值">{{ detail.value }} / {{ detail.thresholdValue }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
        <el-descriptions-item label="确认说明">{{ detail.ackRemark ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="解除说明">{{ detail.resolveRemark ?? '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-timeline class="action-timeline">
        <el-timeline-item v-for="action in detail?.actions ?? []" :key="action.id" :timestamp="formatTime(action.createdAt)">
          <strong>{{ action.action }}</strong>
          <span>{{ action.user?.name ?? action.user?.username ?? '系统' }}</span>
          <p>{{ action.remark ?? '-' }}</p>
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </section>
</template>
```

- [ ] **Step 5: Add scoped CSS only if current global CSS lacks these classes**

If `metric-grid`, `metric-card`, or `filter-bar` do not render correctly, add a `<style scoped>` block:

```css
.filter-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr)) auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.action-timeline {
  margin-top: 20px;
}
```

- [ ] **Step 6: Run admin typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/admin-web typecheck
```

Expected: admin typecheck passes.

---

### Task 5: Screen Updates

**Files:**
- Modify: `apps/screen-web/src/components/RealtimeAlarms.vue`
- Modify: `apps/screen-web/src/components/AreaRiskRanking.vue`

- [ ] **Step 1: Show escalation marker in realtime alarms**

Update `apps/screen-web/src/components/RealtimeAlarms.vue` row content:

```vue
<div v-for="alarm in alarms" :key="alarm.id" class="alarm-row" :class="{ escalated: alarm.escalationLevel > 0 }">
  <strong>{{ alarm.device?.code ?? alarm.deviceId }}</strong>
  <span>{{ alarm.message }}</span>
  <em>{{ alarm.escalationLevel > 0 ? '升级 ' : '' }}{{ alarm.severity }}</em>
</div>
```

Add scoped style:

```vue
<style scoped>
.alarm-row.escalated {
  border-left: 3px solid #ff4d4f;
}
</style>
```

- [ ] **Step 2: Show escalated count in area risk ranking**

Update `apps/screen-web/src/components/AreaRiskRanking.vue` row content:

```vue
<div v-for="item in data.slice(0, 6)" :key="item.areaId" class="rank-row">
  <span>{{ item.areaName }}</span>
  <small v-if="item.escalatedAlarms">升级 {{ item.escalatedAlarms }}</small>
  <strong>{{ item.riskScore }}</strong>
</div>
```

- [ ] **Step 3: Run screen typecheck**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm --filter @gas-detection/screen-web typecheck
```

Expected: screen typecheck passes.

---

### Task 6: End-To-End Verification And Delivery

**Files:**
- Read: `README.md`
- Read: `docs/superpowers/specs/2026-06-30-alarm-closure-design.md`
- Modify: no files unless verification reveals a documented behavior mismatch.

- [ ] **Step 1: Generate Prisma client**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm prisma:generate
```

Expected: Prisma Client generation succeeds.

- [ ] **Step 2: Run all typechecks**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm -r typecheck
```

Expected: all workspace typechecks pass.

- [ ] **Step 3: Run all tests**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm -r test
```

Expected: API Jest suites pass and simulator Vitest suite passes.

- [ ] **Step 4: Run all builds**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm -r build
```

Expected: API, admin web, screen web, simulator, and shared package build.

- [ ] **Step 5: Rebuild and start Docker stack**

Run:

```bash
./scripts/docker-up.sh
```

Expected: all services are `Up`, Postgres and Redis are healthy, simulator logs show cycles.

- [ ] **Step 6: Verify API runtime with token**

Run:

```bash
PATH=/Users/chocky/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node <<'NODE'
const login = await fetch('http://localhost:3000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
});
const loginJson = await login.json();
const token = loginJson?.data?.data?.accessToken;
console.log('login', login.status, Boolean(token));
const stats = await fetch('http://localhost:3000/api/v1/alarms/statistics', {
  headers: { authorization: `Bearer ${token}` },
});
console.log('statistics', stats.status);
const details = await stats.json();
console.log(Object.keys(details.data ?? details).sort().join(','));
NODE
```

Expected: `login 201 true`, `statistics 200`, and output includes `byGasType,bySeverity,byStatus,escalatedActive,latestActive`.

- [ ] **Step 7: Verify browser entry points with HTTP**

Run:

```bash
curl -fsSI http://localhost:8080 | sed -n '1,5p'
curl -fsSI http://localhost:8081 | sed -n '1,5p'
curl -fsSI http://localhost:3000/api/docs | sed -n '1,5p'
```

Expected: each command returns HTTP 200.

- [ ] **Step 8: Commit implementation**

Run:

```bash
git status --short
git add prisma/schema.prisma apps/api apps/admin-web apps/screen-web package.json pnpm-lock.yaml
git commit -m "feat: add alarm closure workflow"
git push origin main
```

Expected: commit and push succeed. If GitHub reports repository moved, the push may still succeed through redirect; keep the local remote unchanged unless the user asks to rename it.

---

## Self-Review

Spec coverage:

- Remarks on confirm and resolve: Task 1 and Task 2.
- Alarm detail drawer and action timeline: Task 2 and Task 4.
- `ACK`, `RESOLVE`, `ESCALATE` action log: Task 2 and Task 3.
- Automatic escalation: Task 3.
- Statistics endpoint: Task 1, Task 2, Task 4, Task 6.
- WebSocket updates: Task 3, Task 4, Task 5.
- Screen risk weighting: Task 3 and Task 5.
- Verification: Task 6.

Placeholder scan:

- This plan contains no placeholder markers, omitted code block, or "similar to" task.

Type consistency:

- Request DTO name is `AlarmActionDto`.
- Service methods are `ack(id, userId, remark)`, `resolve(id, userId, remark)`, and `statistics()`.
- Escalation service method is `scanAndEscalate()`.
- Frontend helpers are `getAlarm`, `getAlarmStatistics`, `ackAlarm`, and `resolveAlarm`.
