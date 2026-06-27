import { Injectable } from '@nestjs/common';
import { AlarmEvent, AlarmRule, AlarmStatus, DeviceStatus, GasType, RuleOperator, SensorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface TelemetryForEvaluation {
  ch4: number;
  o2: number;
  co: number;
  h2s: number;
  batteryLevel: number;
  onlineStatus?: DeviceStatus;
  sensorStatus?: SensorStatus;
}

interface AlarmEvaluationInput {
  deviceId: string;
  deviceCode: string;
  telemetry: TelemetryForEvaluation;
}

@Injectable()
export class AlarmEvaluatorService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(input: AlarmEvaluationInput): Promise<{ created: AlarmEvent[]; resolved: AlarmEvent[] }> {
    const rules = await this.prisma.alarmRule.findMany({ where: { enabled: true } });
    const created: AlarmEvent[] = [];
    const resolved: AlarmEvent[] = [];

    for (const rule of rules) {
      const value = this.valueForRule(rule.gasType, input.telemetry);
      const activeAlarm = await this.prisma.alarmEvent.findFirst({
        where: {
          deviceId: input.deviceId,
          ruleId: rule.id,
          status: AlarmStatus.ACTIVE,
        },
      });

      if (this.isTriggered(value, rule.operator, rule.thresholdValue)) {
        if (!activeAlarm) {
          created.push(await this.createAlarm(input, rule, value));
        }
        continue;
      }

      if (activeAlarm) {
        resolved.push(
          await this.prisma.alarmEvent.update({
            where: { id: activeAlarm.id },
            data: {
              status: AlarmStatus.RESOLVED,
              resolvedAt: new Date(),
            },
          }),
        );
      }
    }

    return { created, resolved };
  }

  isTriggered(value: number, operator: RuleOperator, threshold: number): boolean {
    switch (operator) {
      case RuleOperator.GT:
        return value > threshold;
      case RuleOperator.GTE:
        return value >= threshold;
      case RuleOperator.LT:
        return value < threshold;
      case RuleOperator.LTE:
        return value <= threshold;
      case RuleOperator.EQ:
        return value === threshold;
    }
  }

  private valueForRule(gasType: GasType, telemetry: TelemetryForEvaluation): number {
    switch (gasType) {
      case GasType.CH4:
        return telemetry.ch4;
      case GasType.O2:
        return telemetry.o2;
      case GasType.CO:
        return telemetry.co;
      case GasType.H2S:
        return telemetry.h2s;
      case GasType.BATTERY:
        return telemetry.batteryLevel;
    }
  }

  private createAlarm(input: AlarmEvaluationInput, rule: AlarmRule, value: number) {
    return this.prisma.alarmEvent.create({
      data: {
        deviceId: input.deviceId,
        ruleId: rule.id,
        gasType: rule.gasType,
        severity: rule.severity,
        status: AlarmStatus.ACTIVE,
        value,
        thresholdValue: rule.thresholdValue,
        message: `${input.deviceCode} ${rule.name}：当前值 ${value}，阈值 ${rule.thresholdValue}`,
        startedAt: new Date(),
      },
    });
  }
}
