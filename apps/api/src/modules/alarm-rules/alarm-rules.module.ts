import { Module } from '@nestjs/common';
import { AlarmRulesController } from './alarm-rules.controller';
import { AlarmRulesService } from './alarm-rules.service';

@Module({
  controllers: [AlarmRulesController],
  providers: [AlarmRulesService],
  exports: [AlarmRulesService],
})
export class AlarmRulesModule {}
