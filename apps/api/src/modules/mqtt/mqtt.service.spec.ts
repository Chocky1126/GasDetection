import { ConfigService } from '@nestjs/config';
import { TelemetryIngestionService } from './telemetry-ingestion.service';
import { MqttService } from './mqtt.service';

describe('MqttService', () => {
  it('isolates telemetry processing failures from the MQTT message callback', async () => {
    const telemetryIngestion = {
      handleTelemetry: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as TelemetryIngestionService;
    const service = new MqttService({} as ConfigService, telemetryIngestion);
    jest.spyOn((service as any).logger, 'error').mockImplementation();

    await expect(
      (service as any).handleMessage(
        'gas/devices/GD-001/telemetry',
        Buffer.from(JSON.stringify({ deviceCode: 'GD-001' })),
      ),
    ).resolves.toBeUndefined();
  });
});
