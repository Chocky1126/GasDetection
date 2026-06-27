import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MonitorService } from './monitor.service';

@ApiTags('monitor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  @Get('overview')
  @Permissions('monitor:read')
  overview() {
    return this.monitorService.getOverview();
  }

  @Get('snapshots')
  @Permissions('monitor:read')
  snapshots(@Query() query: ListQueryDto) {
    return this.monitorService.getSnapshots(query);
  }

  @Get('trends')
  @Permissions('monitor:read')
  trends() {
    return this.monitorService.getTrends();
  }

  @Get('status-distribution')
  @Permissions('monitor:read')
  statusDistribution() {
    return this.monitorService.getStatusDistribution();
  }

  @Get('area-risk-ranking')
  @Permissions('monitor:read')
  areaRiskRanking() {
    return this.monitorService.getAreaRiskRanking();
  }
}
