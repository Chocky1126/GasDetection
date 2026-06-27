import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { AlarmsService } from './alarms.service';
import { AlarmQueryDto } from './dto/alarm-query.dto';

@ApiTags('alarms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('alarms')
export class AlarmsController {
  constructor(private readonly alarmsService: AlarmsService) {}

  @Get()
  @Permissions('alarms:read')
  findAll(@Query() query: AlarmQueryDto) {
    return this.alarmsService.findAll(query);
  }

  @Get(':id')
  @Permissions('alarms:read')
  findOne(@Param('id') id: string) {
    return this.alarmsService.findOne(id);
  }

  @Patch(':id/ack')
  @Permissions('alarms:write')
  ack(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alarmsService.ack(id, user?.id);
  }

  @Patch(':id/resolve')
  @Permissions('alarms:write')
  resolve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.alarmsService.resolve(id, user?.id);
  }
}
