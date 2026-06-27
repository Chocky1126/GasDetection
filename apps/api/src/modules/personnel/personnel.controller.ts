import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';
import { PersonnelService } from './personnel.service';

@ApiTags('personnel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('personnel')
export class PersonnelController {
  constructor(private readonly personnelService: PersonnelService) {}

  @Get()
  @Permissions('personnel:read')
  findAll(@Query() query: ListQueryDto) {
    return this.personnelService.findAll(query);
  }

  @Post()
  @Permissions('personnel:write')
  create(@Body() dto: CreatePersonnelDto) {
    return this.personnelService.create(dto);
  }

  @Patch(':id')
  @Permissions('personnel:write')
  update(@Param('id') id: string, @Body() dto: UpdatePersonnelDto) {
    return this.personnelService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('personnel:write')
  remove(@Param('id') id: string) {
    return this.personnelService.remove(id);
  }
}
