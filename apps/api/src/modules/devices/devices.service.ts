import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus, Prisma, SensorStatus } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { DeviceQueryDto } from './dto/device-query.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

const deviceInclude = {
  area: true,
  baseStation: true,
  snapshot: true,
} satisfies Prisma.DeviceInclude;

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: DeviceQueryDto) {
    const where: Prisma.DeviceWhereInput = {
      status: query.status,
      areaId: query.areaId,
      baseStationId: query.baseStationId,
      OR: query.keyword
        ? [
            { code: { contains: query.keyword, mode: 'insensitive' } },
            { name: { contains: query.keyword, mode: 'insensitive' } },
            { serialNumber: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.device.findMany({
        where,
        ...pagination(query),
        orderBy: { createdAt: 'desc' },
        include: deviceInclude,
      }),
      this.prisma.device.count({ where }),
    ]);

    return paginated(items, total, query);
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, include: deviceInclude });
    if (!device) {
      throw new NotFoundException('设备不存在');
    }
    return device;
  }

  async create(dto: CreateDeviceDto) {
    const existing = await this.prisma.device.findFirst({
      where: {
        OR: [{ code: dto.code }, { serialNumber: dto.serialNumber }],
      },
    });
    if (existing) {
      throw new ConflictException('设备编码或序列号已存在');
    }

    return this.prisma.device.create({
      data: {
        code: dto.code,
        name: dto.name,
        model: dto.model,
        serialNumber: dto.serialNumber,
        status: dto.status ?? DeviceStatus.OFFLINE,
        areaId: dto.areaId,
        baseStationId: dto.baseStationId,
        snapshot: {
          create: {
            status: dto.status ?? DeviceStatus.OFFLINE,
            sensorStatus: SensorStatus.NORMAL,
            ch4: 0,
            o2: 20.9,
            co: 0,
            h2s: 0,
            batteryLevel: 100,
            lng: 0,
            lat: 0,
            depth: 0,
          },
        },
      },
      include: deviceInclude,
    });
  }

  async update(id: string, dto: UpdateDeviceDto) {
    await this.findOne(id);
    return this.prisma.device.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        model: dto.model,
        serialNumber: dto.serialNumber,
        status: dto.status,
        areaId: dto.areaId,
        baseStationId: dto.baseStationId,
      },
      include: deviceInclude,
    });
  }

  async remove(id: string) {
    await this.prisma.device.delete({ where: { id } });
    return { id };
  }

  async findTelemetry(id: string, query: ListQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.telemetryRecord.findMany({
        where: { deviceId: id },
        ...pagination(query),
        orderBy: { reportedAt: 'desc' },
      }),
      this.prisma.telemetryRecord.count({ where: { deviceId: id } }),
    ]);
    return paginated(items, total, query);
  }

  async findAlarms(id: string, query: ListQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.alarmEvent.findMany({
        where: { deviceId: id },
        ...pagination(query),
        orderBy: { startedAt: 'desc' },
        include: { rule: true },
      }),
      this.prisma.alarmEvent.count({ where: { deviceId: id } }),
    ]);
    return paginated(items, total, query);
  }
}
