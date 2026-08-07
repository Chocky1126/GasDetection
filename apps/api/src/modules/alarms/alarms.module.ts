import { Module } from '@nestjs/common';
import { MonitorModule } from '../monitor/monitor.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AlarmEscalationService } from './alarm-escalation.service';
import { AlarmEvaluatorService } from './alarm-evaluator.service';
import { AlarmsController } from './alarms.controller';
import { AlarmsService } from './alarms.service';

@Module({
  imports: [RealtimeModule, MonitorModule],
  controllers: [AlarmsController],
  providers: [AlarmsService, AlarmEvaluatorService, AlarmEscalationService],
  exports: [AlarmsService, AlarmEvaluatorService, AlarmEscalationService],
})
export class AlarmsModule {}
