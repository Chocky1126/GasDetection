import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { BaseStationsService } from './base-stations.service';
import { CreateBaseStationDto } from './dto/create-base-station.dto';
import { UpdateBaseStationDto } from './dto/update-base-station.dto';

@ApiTags('base-stations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('base-stations')
export class BaseStationsController {
  constructor(private readonly baseStationsService: BaseStationsService) {}

  @Get()
  @Permissions('base-stations:read')
  findAll(@Query() query: ListQueryDto) {
    return this.baseStationsService.findAll(query);
  }

  @Post()
  @Permissions('base-stations:write')
  create(@Body() dto: CreateBaseStationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.baseStationsService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions('base-stations:write')
  update(@Param('id') id: string, @Body() dto: UpdateBaseStationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.baseStationsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('base-stations:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.baseStationsService.remove(id, user.id);
  }
}
