import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { TelemetryIngestionService } from './telemetry-ingestion.service';

const MQTT_TOPICS = {
  telemetry: 'gas/devices/+/telemetry',
  status: 'gas/devices/+/status',
  fault: 'gas/devices/+/fault',
  alarm: 'gas/devices/+/alarm',
} as const;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client?: MqttClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly telemetryIngestion: TelemetryIngestionService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const mqttUrl = this.configService.get<string>('MQTT_URL') ?? 'mqtt://localhost:1883';
    this.client = mqtt.connect(mqttUrl);
    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker: ${mqttUrl}`);
      this.client?.subscribe(Object.values(MQTT_TOPICS));
    });
    this.client.on('message', (topic, message) => {
      void this.handleMessage(topic, message);
    });
    this.client.on('error', (error) => {
      this.logger.error(`MQTT error: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    this.client?.end(true);
  }

  private async handleMessage(topic: string, message: Buffer) {
    let payload: unknown;
    try {
      payload = JSON.parse(message.toString('utf8'));
    } catch (error) {
      this.logger.warn(`Invalid MQTT JSON on ${topic}: ${(error as Error).message}`);
      return;
    }

    if (topic.endsWith('/telemetry')) {
      await this.telemetryIngestion.handleTelemetry(payload as never);
    }
  }
}
