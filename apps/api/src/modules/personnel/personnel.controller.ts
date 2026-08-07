import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
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
  create(@Body() dto: CreatePersonnelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.personnelService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions('personnel:write')
  update(@Param('id') id: string, @Body() dto: UpdatePersonnelDto, @CurrentUser() user: AuthenticatedUser) {
    return this.personnelService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('personnel:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.personnelService.remove(id, user.id);
  }
}
