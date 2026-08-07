import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CalibrationsService } from './calibrations.service';
import { CalibrationQueryDto } from './dto/calibration-query.dto';
import { CreateCalibrationDto } from './dto/create-calibration.dto';

@ApiTags('calibrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('calibrations')
export class CalibrationsController {
  constructor(private readonly calibrationsService: CalibrationsService) {}

  @Get()
  @Permissions('calibrations:read')
  findAll(@Query() query: CalibrationQueryDto) {
    return this.calibrationsService.findAll(query);
  }

  @Get('overview')
  @Permissions('calibrations:read')
  overview() {
    return this.calibrationsService.overview();
  }

  @Get('due-devices')
  @Permissions('calibrations:read')
  dueDevices() {
    return this.calibrationsService.dueDevices();
  }

  @Post()
  @Permissions('calibrations:write')
  create(@Body() dto: CreateCalibrationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calibrationsService.create(dto, user?.id);
  }
}
