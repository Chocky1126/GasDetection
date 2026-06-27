import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AlarmRulesService } from './alarm-rules.service';
import { CreateAlarmRuleDto } from './dto/create-alarm-rule.dto';
import { UpdateAlarmRuleDto } from './dto/update-alarm-rule.dto';

@ApiTags('alarm-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('alarm-rules')
export class AlarmRulesController {
  constructor(private readonly alarmRulesService: AlarmRulesService) {}

  @Get()
  @Permissions('alarm-rules:read')
  findAll() {
    return this.alarmRulesService.findAll();
  }

  @Post()
  @Permissions('alarm-rules:write')
  create(@Body() dto: CreateAlarmRuleDto) {
    return this.alarmRulesService.create(dto);
  }

  @Patch(':id')
  @Permissions('alarm-rules:write')
  update(@Param('id') id: string, @Body() dto: UpdateAlarmRuleDto) {
    return this.alarmRulesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('alarm-rules:write')
  remove(@Param('id') id: string) {
    return this.alarmRulesService.remove(id);
  }
}
