import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MonitorService } from '../monitor/monitor.service';
import { AlarmsController } from './alarms.controller';
import { AlarmsService } from './alarms.service';

describe('AlarmsController', () => {
  it('emits realtime alarm and screen metrics updates after acknowledging an alarm', async () => {
    const alarm = { id: 'alarm-1', status: 'ACKED' };
    const metrics = { overview: { totalDevices: 100, activeAlarms: 2 }, areaRiskRanking: [] };
    const alarmsService = {
      ack: jest.fn().mockResolvedValue(alarm),
    } as unknown as AlarmsService;
    const realtimeGateway = {
      emitAlarmUpdated: jest.fn(),
      emitScreenOverviewUpdated: jest.fn(),
      emitScreenMetricsUpdated: jest.fn(),
    } as unknown as RealtimeGateway;
    const monitorService = {
      getOverview: jest.fn().mockResolvedValue(metrics.overview),
      getScreenMetrics: jest.fn().mockResolvedValue(metrics),
    } as unknown as MonitorService;
    const controller = new AlarmsController(alarmsService, realtimeGateway, monitorService);

    await expect(controller.ack('alarm-1', { remark: '已确认' }, { id: 'user-1' } as any)).resolves.toBe(alarm);

    expect(alarmsService.ack).toHaveBeenCalledWith('alarm-1', 'user-1', '已确认');
    expect(realtimeGateway.emitAlarmUpdated).toHaveBeenCalledWith(alarm);
    expect(monitorService.getScreenMetrics).toHaveBeenCalled();
    expect((realtimeGateway as any).emitScreenMetricsUpdated).toHaveBeenCalledWith(metrics);
  });

  it('emits realtime alarm and screen metrics updates after resolving an alarm', async () => {
    const alarm = { id: 'alarm-1', status: 'RESOLVED' };
    const metrics = { overview: { totalDevices: 100, activeAlarms: 1 }, areaRiskRanking: [] };
    const alarmsService = {
      resolve: jest.fn().mockResolvedValue(alarm),
    } as unknown as AlarmsService;
    const realtimeGateway = {
      emitAlarmUpdated: jest.fn(),
      emitScreenOverviewUpdated: jest.fn(),
      emitScreenMetricsUpdated: jest.fn(),
    } as unknown as RealtimeGateway;
    const monitorService = {
      getOverview: jest.fn().mockResolvedValue(metrics.overview),
      getScreenMetrics: jest.fn().mockResolvedValue(metrics),
    } as unknown as MonitorService;
    const controller = new AlarmsController(alarmsService, realtimeGateway, monitorService);

    await expect(controller.resolve('alarm-1', { remark: '已解除' }, { id: 'user-1' } as any)).resolves.toBe(alarm);

    expect(alarmsService.resolve).toHaveBeenCalledWith('alarm-1', 'user-1', '已解除');
    expect(realtimeGateway.emitAlarmUpdated).toHaveBeenCalledWith(alarm);
    expect(monitorService.getScreenMetrics).toHaveBeenCalled();
    expect((realtimeGateway as any).emitScreenMetricsUpdated).toHaveBeenCalledWith(metrics);
  });
});
