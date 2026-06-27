import { AlarmSeverity, AlarmStatus, DeviceStatus, GasType, RuleOperator, SensorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmEvaluatorService } from './alarm-evaluator.service';

describe('AlarmEvaluatorService', () => {
  it('creates an active alarm when CH4 crosses a configured threshold', async () => {
    const alarmCreate = jest.fn().mockResolvedValue({ id: 'alarm-1' });
    const prisma = {
      alarmRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rule-1',
            name: '甲烷高限报警',
            gasType: GasType.CH4,
            operator: RuleOperator.GTE,
            thresholdValue: 1,
            severity: AlarmSeverity.HIGH,
          },
        ]),
      },
      alarmEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: alarmCreate,
      },
    } as unknown as PrismaService;
    const service = new AlarmEvaluatorService(prisma);

    const result = await service.evaluate({
      deviceId: 'device-1',
      deviceCode: 'GAS-0001',
      telemetry: {
        ch4: 1.2,
        o2: 20.8,
        co: 1,
        h2s: 1,
        batteryLevel: 90,
        onlineStatus: DeviceStatus.ONLINE,
        sensorStatus: SensorStatus.NORMAL,
      },
    });

    expect(result.created).toHaveLength(1);
    expect(alarmCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: 'device-1',
        ruleId: 'rule-1',
        gasType: GasType.CH4,
        severity: AlarmSeverity.HIGH,
        status: AlarmStatus.ACTIVE,
        value: 1.2,
        thresholdValue: 1,
      }),
    });
  });
});
