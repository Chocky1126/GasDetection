import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AlarmEvent, AlarmSeverity, AlarmStatus } from '@prisma/client';
import { MonitorService } from '../monitor/monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type EscalationCandidate = AlarmEvent & {
  rule: { durationSeconds?: number | null } | null;
  device: unknown;
};

@Injectable()
export class AlarmEscalationService {
  private readonly logger = new Logger(AlarmEscalationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly monitorService: MonitorService,
  ) {}

  @Interval(60_000)
  async scan() {
    try {
      await this.scanAndEscalate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Alarm escalation scan failed: ${message}`, stack);
    }
  }

  async scanAndEscalate(now = new Date()) {
    const candidates = await this.prisma.alarmEvent.findMany({
      where: { status: AlarmStatus.ACTIVE, escalationLevel: 0 },
      include: { rule: true, device: true },
    });

    let escalated = 0;
    for (const alarm of candidates) {
      const deadlineSeconds = this.escalationDeadlineSeconds(alarm);
      const overdueMs = now.getTime() - alarm.startedAt.getTime();
      if (overdueMs < deadlineSeconds * 1000) {
        continue;
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.alarmEvent.updateMany({
          where: { id: alarm.id, status: AlarmStatus.ACTIVE, escalationLevel: 0 },
          data: {
            severity: this.nextSeverity(alarm.severity),
            escalationLevel: 1,
            escalatedAt: now,
          },
        });
        if (result.count !== 1) {
          return null;
        }
        await tx.alarmActionLog.create({
          data: {
            alarmId: alarm.id,
            action: 'ESCALATE',
            remark: `报警超过 ${deadlineSeconds} 秒未确认，自动升级`,
          },
        });
        return tx.alarmEvent.findUnique({
          where: { id: alarm.id },
          include: {
            rule: true,
            device: true,
            actions: {
              orderBy: { createdAt: 'desc' },
            },
          },
        });
      });
      if (!updated) {
        continue;
      }

      this.realtimeGateway.emitAlarmUpdated({ ...updated, latestAction: 'ESCALATE' });
      escalated += 1;
    }

    if (escalated > 0) {
      this.realtimeGateway.emitScreenOverviewUpdated(await this.monitorService.getOverview());
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
    if (index === -1) return severity;
    return order[Math.min(index + 1, order.length - 1)];
  }
}
