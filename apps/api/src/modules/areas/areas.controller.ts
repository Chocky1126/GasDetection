import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@ApiTags('areas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Get()
  @Permissions('areas:read')
  findAll(@Query() query: ListQueryDto) {
    return this.areasService.findAll(query);
  }

  @Post()
  @Permissions('areas:write')
  create(@Body() dto: CreateAreaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions('areas:write')
  update(@Param('id') id: string, @Body() dto: UpdateAreaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('areas:write')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.areasService.remove(id, user.id);
  }
}
