import { Module } from '@nestjs/common';
import { AlarmsModule } from '../alarms/alarms.module';
import { MonitorModule } from '../monitor/monitor.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MqttService } from './mqtt.service';
import { TelemetryIngestionService } from './telemetry-ingestion.service';

@Module({
  imports: [AlarmsModule, RealtimeModule, MonitorModule],
  providers: [MqttService, TelemetryIngestionService],
  exports: [TelemetryIngestionService],
})
export class MqttModule {}
