import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
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
  create(@Body() dto: CreateBaseStationDto) {
    return this.baseStationsService.create(dto);
  }

  @Patch(':id')
  @Permissions('base-stations:write')
  update(@Param('id') id: string, @Body() dto: UpdateBaseStationDto) {
    return this.baseStationsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('base-stations:write')
  remove(@Param('id') id: string) {
    return this.baseStationsService.remove(id);
  }
}
