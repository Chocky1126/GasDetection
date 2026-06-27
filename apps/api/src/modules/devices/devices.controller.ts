import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Permissions('devices:read')
  findAll(@Query() query: DeviceQueryDto) {
    return this.devicesService.findAll(query);
  }

  @Post()
  @Permissions('devices:write')
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Get(':id')
  @Permissions('devices:read')
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('devices:write')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.devicesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('devices:write')
  remove(@Param('id') id: string) {
    return this.devicesService.remove(id);
  }

  @Get(':id/telemetry')
  @Permissions('devices:read')
  telemetry(@Param('id') id: string, @Query() query: ListQueryDto) {
    return this.devicesService.findTelemetry(id, query);
  }

  @Get(':id/alarms')
  @Permissions('devices:read')
  alarms(@Param('id') id: string, @Query() query: ListQueryDto) {
    return this.devicesService.findAlarms(id, query);
  }
}
