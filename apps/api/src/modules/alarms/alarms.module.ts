import { Module } from '@nestjs/common';
import { AlarmEvaluatorService } from './alarm-evaluator.service';
import { AlarmsController } from './alarms.controller';
import { AlarmsService } from './alarms.service';

@Module({
  controllers: [AlarmsController],
  providers: [AlarmsService, AlarmEvaluatorService],
  exports: [AlarmsService, AlarmEvaluatorService],
})
export class AlarmsModule {}
