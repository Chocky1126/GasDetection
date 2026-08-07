import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Permissions('teams:read')
  findAll(@Query() query: ListQueryDto) {
    return this.teamsService.findAll(query);
  }

  @Post()
  @Permissions('teams:write')
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions('teams:write')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('teams:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.remove(id, user.id);
  }
}
