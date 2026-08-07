import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('permissions')
  @Permissions('roles:read')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Get()
  @Permissions('roles:read')
  findAll(@Query() query: ListQueryDto) {
    return this.rolesService.findAll(query);
  }

  @Post()
  @Permissions('roles:write')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions('roles:write')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('roles:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.remove(id, user.id);
  }
}
