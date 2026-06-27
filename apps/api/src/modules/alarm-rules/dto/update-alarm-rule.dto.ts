import { PartialType } from '@nestjs/swagger';
import { CreateAlarmRuleDto } from './create-alarm-rule.dto';

export class UpdateAlarmRuleDto extends PartialType(CreateAlarmRuleDto) {}
