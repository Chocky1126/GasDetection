import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CalibrationsService } from './calibrations.service';
import { CreateCalibrationDto } from './dto/create-calibration.dto';

@ApiTags('calibrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('calibrations')
export class CalibrationsController {
  constructor(private readonly calibrationsService: CalibrationsService) {}

  @Get()
  @Permissions('calibrations:read')
  findAll(@Query() query: ListQueryDto) {
    return this.calibrationsService.findAll(query);
  }

  @Post()
  @Permissions('calibrations:write')
  create(@Body() dto: CreateCalibrationDto) {
    return this.calibrationsService.create(dto);
  }
}
