import { PartialType } from '@nestjs/swagger';
import { CreateBaseStationDto } from './create-base-station.dto';

export class UpdateBaseStationDto extends PartialType(CreateBaseStationDto) {}
