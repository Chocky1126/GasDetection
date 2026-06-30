import { AlarmSeverity, AlarmStatus } from '@prisma/client';
import { MonitorService } from '../monitor/monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AlarmEscalationService } from './alarm-escalation.service';

describe('AlarmEscalationService', () => {
  it('escalates overdue active alarms, records action logs, and emits realtime updates', async () => {
    const now = new Date('2026-06-30T10:00:00.000Z');
    const overdueAlarm = {
      id: 'alarm-1',
      status: AlarmStatus.ACTIVE,
      severity: AlarmSeverity.LOW,
      escalationLevel: 0,
      startedAt: new Date('2026-06-30T09:58:00.000Z'),
      rule: { durationSeconds: 60 },
      device: { id: 'device-1' },
    };
    const updatedAlarm = {
      ...overdueAlarm,
      severity: AlarmSeverity.MEDIUM,
      escalationLevel: 1,
      escalatedAt: now,
      actions: [{ action: 'ESCALATE' }],
    };
    const metrics = { overview: { totalDevices: 100, activeAlarms: 1 }, areaRiskRanking: [] };
    const tx = {
      alarmEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(updatedAlarm),
      },
      alarmActionLog: {
        create: jest.fn().mockResolvedValue({ id: 'action-1' }),
      },
    };
    const transaction = jest.fn(async (callback) => callback(tx));
    const prisma = {
      alarmEvent: {
        findMany: jest.fn().mockResolvedValue([overdueAlarm]),
        updateMany: jest.fn(),
      },
      alarmActionLog: { create: jest.fn() },
      $transaction: transaction,
    } as unknown as PrismaService;
    const gateway = {
      emitAlarmUpdated: jest.fn(),
      emitScreenOverviewUpdated: jest.fn(),
      emitScreenMetricsUpdated: jest.fn(),
    } as unknown as RealtimeGateway;
    const monitorService = {
      getOverview: jest.fn().mockResolvedValue(metrics.overview),
      getScreenMetrics: jest.fn().mockResolvedValue(metrics),
    } as unknown as MonitorService;
    const service = new AlarmEscalationService(prisma, gateway, monitorService);

    const result = await service.scanAndEscalate(now);

    expect(result).toEqual({ scanned: 1, escalated: 1 });
    expect(prisma.alarmEvent.findMany).toHaveBeenCalledWith({
      where: { status: AlarmStatus.ACTIVE, escalationLevel: 0 },
      include: { rule: true, device: true },
    });
    expect(tx.alarmEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'alarm-1', status: AlarmStatus.ACTIVE, escalationLevel: 0 },
      data: {
        severity: AlarmSeverity.MEDIUM,
        escalationLevel: 1,
        escalatedAt: now,
      },
    });
    expect(tx.alarmActionLog.create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        action: 'ESCALATE',
        remark: '报警超过 60 秒未确认，自动升级',
      },
    });
    expect(tx.alarmEvent.findUnique).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      include: {
        rule: true,
        device: true,
        actions: { orderBy: { createdAt: 'desc' } },
      },
    });
    expect(gateway.emitAlarmUpdated).toHaveBeenCalledWith({ ...updatedAlarm, latestAction: 'ESCALATE' });
    expect(monitorService.getScreenMetrics).toHaveBeenCalled();
    expect((gateway as any).emitScreenMetricsUpdated).toHaveBeenCalledWith(metrics);
  });

  it('keeps critical severity at critical', () => {
    const service = new AlarmEscalationService({} as PrismaService, {} as RealtimeGateway, {} as MonitorService);

    expect(service.nextSeverity(AlarmSeverity.CRITICAL)).toBe(AlarmSeverity.CRITICAL);
  });

  it('uses the default five minute deadline when rule duration is missing or invalid', () => {
    const service = new AlarmEscalationService({} as PrismaService, {} as RealtimeGateway, {} as MonitorService);

    expect(service.escalationDeadlineSeconds({ rule: null })).toBe(300);
    expect(service.escalationDeadlineSeconds({ rule: { durationSeconds: null } })).toBe(300);
    expect(service.escalationDeadlineSeconds({ rule: { durationSeconds: 0 } })).toBe(300);
    expect(service.escalationDeadlineSeconds({ rule: { durationSeconds: -1 } })).toBe(300);
  });

  it('does not escalate alarms before their deadline', async () => {
    const now = new Date('2026-06-30T10:00:00.000Z');
    const prisma = {
      alarmEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alarm-1',
            status: AlarmStatus.ACTIVE,
            severity: AlarmSeverity.HIGH,
            escalationLevel: 0,
            startedAt: new Date('2026-06-30T09:59:30.000Z'),
            rule: { durationSeconds: 60 },
            device: { id: 'device-1' },
          },
        ]),
      },
      alarmActionLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const gateway = {
      emitAlarmUpdated: jest.fn(),
      emitScreenOverviewUpdated: jest.fn(),
      emitScreenMetricsUpdated: jest.fn(),
    } as unknown as RealtimeGateway;
    const service = new AlarmEscalationService(prisma, gateway, {} as MonitorService);

    const result = await service.scanAndEscalate(now);

    expect(result).toEqual({ scanned: 1, escalated: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.alarmActionLog.create).not.toHaveBeenCalled();
    expect(gateway.emitAlarmUpdated).not.toHaveBeenCalled();
    expect(gateway.emitScreenOverviewUpdated).not.toHaveBeenCalled();
    expect((gateway as any).emitScreenMetricsUpdated).not.toHaveBeenCalled();
  });

  it('skips logging and realtime events when the guarded update loses the race', async () => {
    const now = new Date('2026-06-30T10:00:00.000Z');
    const overdueAlarm = {
      id: 'alarm-1',
      status: AlarmStatus.ACTIVE,
      severity: AlarmSeverity.HIGH,
      escalationLevel: 0,
      startedAt: new Date('2026-06-30T09:50:00.000Z'),
      rule: { durationSeconds: 60 },
      device: { id: 'device-1' },
    };
    const tx = {
      alarmEvent: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
      alarmActionLog: {
        create: jest.fn(),
      },
    };
    const prisma = {
      alarmEvent: {
        findMany: jest.fn().mockResolvedValue([overdueAlarm]),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService;
    const gateway = {
      emitAlarmUpdated: jest.fn(),
      emitScreenOverviewUpdated: jest.fn(),
      emitScreenMetricsUpdated: jest.fn(),
    } as unknown as RealtimeGateway;
    const monitorService = { getOverview: jest.fn(), getScreenMetrics: jest.fn() } as unknown as MonitorService;
    const service = new AlarmEscalationService(prisma, gateway, monitorService);

    const result = await service.scanAndEscalate(now);

    expect(result).toEqual({ scanned: 1, escalated: 0 });
    expect(tx.alarmActionLog.create).not.toHaveBeenCalled();
    expect(tx.alarmEvent.findUnique).not.toHaveBeenCalled();
    expect(gateway.emitAlarmUpdated).not.toHaveBeenCalled();
    expect(monitorService.getScreenMetrics).not.toHaveBeenCalled();
    expect(gateway.emitScreenOverviewUpdated).not.toHaveBeenCalled();
    expect((gateway as any).emitScreenMetricsUpdated).not.toHaveBeenCalled();
  });
});
