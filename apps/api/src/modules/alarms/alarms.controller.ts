import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { MonitorService } from '../monitor/monitor.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AlarmsService } from './alarms.service';
import { AlarmActionDto } from './dto/alarm-action.dto';
import { AlarmQueryDto } from './dto/alarm-query.dto';

@ApiTags('alarms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('alarms')
export class AlarmsController {
  constructor(
    private readonly alarmsService: AlarmsService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly monitorService: MonitorService,
  ) {}

  @Get()
  @Permissions('alarms:read')
  findAll(@Query() query: AlarmQueryDto) {
    return this.alarmsService.findAll(query);
  }

  @Get('statistics')
  @Permissions('alarms:read')
  statistics() {
    return this.alarmsService.statistics();
  }

  @Get(':id')
  @Permissions('alarms:read')
  findOne(@Param('id') id: string) {
    return this.alarmsService.findOne(id);
  }

  @Patch(':id/ack')
  @Permissions('alarms:write')
  async ack(@Param('id') id: string, @Body() body: AlarmActionDto, @CurrentUser() user: AuthenticatedUser) {
    const alarm = await this.alarmsService.ack(id, user?.id, body?.remark);
    await this.emitAlarmChanged(alarm);
    return alarm;
  }

  @Patch(':id/resolve')
  @Permissions('alarms:write')
  async resolve(@Param('id') id: string, @Body() body: AlarmActionDto, @CurrentUser() user: AuthenticatedUser) {
    const alarm = await this.alarmsService.resolve(id, user?.id, body?.remark);
    await this.emitAlarmChanged(alarm);
    return alarm;
  }

  private async emitAlarmChanged(alarm: unknown) {
    this.realtimeGateway.emitAlarmUpdated(alarm);
    this.realtimeGateway.emitScreenOverviewUpdated(await this.monitorService.getOverview());
  }
}
