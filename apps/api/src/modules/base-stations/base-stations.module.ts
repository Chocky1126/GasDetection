import { Module } from '@nestjs/common';
import { BaseStationsController } from './base-stations.controller';
import { BaseStationsService } from './base-stations.service';

@Module({
  controllers: [BaseStationsController],
  providers: [BaseStationsService],
})
export class BaseStationsModule {}
