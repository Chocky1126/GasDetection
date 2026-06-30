import { PrismaClient, AlarmSeverity, CalibrationResult, DeviceStatus, GasType, RuleOperator, SensorStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ADMIN_USERNAME = 'admin';
const ADMIN_DEFAULT_PASSWORD = 'admin123456';

const permissionGroups = [
  ['dashboard', '首页'],
  ['devices', '设备管理'],
  ['monitor', '实时监测'],
  ['alarm-rules', '报警规则'],
  ['alarms', '报警中心'],
  ['personnel', '人员管理'],
  ['teams', '班组管理'],
  ['areas', '区域管理'],
  ['base-stations', '基站管理'],
  ['calibrations', '标定记录'],
  ['audit-logs', '操作日志'],
  ['users', '用户管理'],
  ['roles', '角色管理'],
] as const;

const areaNames = ['一采区', '二采区', '运输巷', '回风巷', '中央变电所'];
const alarmRules = [
  { name: '甲烷高限报警', gasType: GasType.CH4, operator: RuleOperator.GTE, thresholdValue: 1.0, severity: AlarmSeverity.HIGH },
  { name: '氧气低限报警', gasType: GasType.O2, operator: RuleOperator.LTE, thresholdValue: 19.5, severity: AlarmSeverity.HIGH },
  { name: '一氧化碳报警', gasType: GasType.CO, operator: RuleOperator.GTE, thresholdValue: 24, severity: AlarmSeverity.MEDIUM },
  { name: '硫化氢报警', gasType: GasType.H2S, operator: RuleOperator.GTE, thresholdValue: 10, severity: AlarmSeverity.MEDIUM },
] as const;

function deviceCode(index: number): string {
  return `GAS-${String(index).padStart(4, '0')}`;
}

async function seedRolesAndPermissions() {
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'admin' },
      update: { description: '系统管理员' },
      create: { name: 'admin', description: '系统管理员' },
    }),
    prisma.role.upsert({
      where: { name: 'operator' },
      update: { description: '调度操作员' },
      create: { name: 'operator', description: '调度操作员' },
    }),
    prisma.role.upsert({
      where: { name: 'viewer' },
      update: { description: '只读查看员' },
      create: { name: 'viewer', description: '只读查看员' },
    }),
  ]);

  const permissions = [];
  for (const [module, label] of permissionGroups) {
    for (const action of ['read', 'write']) {
      permissions.push(
        await prisma.permission.upsert({
          where: { code: `${module}:${action}` },
          update: { name: `${label}${action === 'read' ? '查看' : '维护'}`, module },
          create: { code: `${module}:${action}`, name: `${label}${action === 'read' ? '查看' : '维护'}`, module },
        }),
      );
    }
  }

  const [adminRole, operatorRole, viewerRole] = roles;
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });

    if (!permission.code.startsWith('users:') && !permission.code.startsWith('roles:')) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: operatorRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: operatorRole.id, permissionId: permission.id },
      });
    }

    if (permission.code.endsWith(':read')) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: viewerRole.id, permissionId: permission.id } },
        update: {},
        create: { roleId: viewerRole.id, permissionId: permission.id },
      });
    }
  }

  const passwordHash = await bcrypt.hash(ADMIN_DEFAULT_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: { passwordHash, name: '系统管理员', isEnabled: true },
    create: { username: ADMIN_USERNAME, passwordHash, name: '系统管理员', isEnabled: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });
}

async function seedAreasAndBaseStations() {
  const areas = [];
  for (const [index, name] of areaNames.entries()) {
    areas.push(
      await prisma.area.upsert({
        where: { code: `AREA-${index + 1}` },
        update: {
          name,
          description: `${name}井下作业区域`,
          lng: 112.93 + index * 0.002,
          lat: 28.23 + index * 0.002,
          riskLevel: (index % 4) + 1,
        },
        create: {
          code: `AREA-${index + 1}`,
          name,
          description: `${name}井下作业区域`,
          lng: 112.93 + index * 0.002,
          lat: 28.23 + index * 0.002,
          riskLevel: (index % 4) + 1,
        },
      }),
    );
  }

  const baseStations = [];
  for (let index = 1; index <= 10; index += 1) {
    const area = areas[(index - 1) % areas.length];
    baseStations.push(
      await prisma.baseStation.upsert({
        where: { code: `BS-${String(index).padStart(2, '0')}` },
        update: {
          name: `井下基站 ${String(index).padStart(2, '0')}`,
          areaId: area.id,
          lng: area.lng + index * 0.0003,
          lat: area.lat + index * 0.0002,
          depth: -300 - index * 15,
        },
        create: {
          code: `BS-${String(index).padStart(2, '0')}`,
          name: `井下基站 ${String(index).padStart(2, '0')}`,
          areaId: area.id,
          lng: area.lng + index * 0.0003,
          lat: area.lat + index * 0.0002,
          depth: -300 - index * 15,
        },
      }),
    );
  }

  return { areas, baseStations };
}

async function seedDevices(areas: Awaited<ReturnType<typeof seedAreasAndBaseStations>>['areas'], baseStations: Awaited<ReturnType<typeof seedAreasAndBaseStations>>['baseStations']) {
  for (let index = 1; index <= 100; index += 1) {
    const code = deviceCode(index);
    const area = areas[(index - 1) % areas.length];
    const baseStation = baseStations[(index - 1) % baseStations.length];
    const lng = baseStation.lng + ((index % 7) - 3) * 0.00015;
    const lat = baseStation.lat + ((index % 5) - 2) * 0.00012;
    const depth = baseStation.depth - (index % 8) * 3;

    const device = await prisma.device.upsert({
      where: { code },
      update: {
        name: `四合一气体检测仪 ${String(index).padStart(3, '0')}`,
        model: 'GD4-MINE',
        serialNumber: `SN-${code}`,
        areaId: area.id,
        baseStationId: baseStation.id,
        status: DeviceStatus.OFFLINE,
      },
      create: {
        code,
        name: `四合一气体检测仪 ${String(index).padStart(3, '0')}`,
        model: 'GD4-MINE',
        serialNumber: `SN-${code}`,
        areaId: area.id,
        baseStationId: baseStation.id,
        status: DeviceStatus.OFFLINE,
      },
    });

    await prisma.deviceSnapshot.upsert({
      where: { deviceId: device.id },
      update: {
        ch4: 0,
        o2: 20.9,
        co: 0,
        h2s: 0,
        batteryLevel: 100,
        lng,
        lat,
        depth,
        status: DeviceStatus.OFFLINE,
        sensorStatus: SensorStatus.NORMAL,
      },
      create: {
        deviceId: device.id,
        ch4: 0,
        o2: 20.9,
        co: 0,
        h2s: 0,
        batteryLevel: 100,
        lng,
        lat,
        depth,
        status: DeviceStatus.OFFLINE,
        sensorStatus: SensorStatus.NORMAL,
      },
    });
  }
}

async function seedAlarmRules() {
  for (const rule of alarmRules) {
    await prisma.alarmRule.upsert({
      where: { id: `${rule.gasType}-${rule.operator}-${rule.thresholdValue}` },
      update: {
        name: rule.name,
        gasType: rule.gasType,
        operator: rule.operator,
        thresholdValue: rule.thresholdValue,
        severity: rule.severity,
        enabled: true,
        durationSeconds: 0,
      },
      create: {
        id: `${rule.gasType}-${rule.operator}-${rule.thresholdValue}`,
        name: rule.name,
        gasType: rule.gasType,
        operator: rule.operator,
        thresholdValue: rule.thresholdValue,
        severity: rule.severity,
        enabled: true,
        durationSeconds: 0,
      },
    });
  }
}

async function seedCalibrationRecords() {
  const devices = await prisma.device.findMany({ take: 8, orderBy: { code: 'asc' } });
  const personnel = await prisma.personnel.findMany({ take: 4, orderBy: { code: 'asc' } });
  const teams = await prisma.team.findMany({ take: 2, orderBy: { code: 'asc' } });
  const gasTypes = [GasType.CH4, GasType.O2, GasType.CO, GasType.H2S];
  const now = new Date();

  for (const [deviceIndex, device] of devices.entries()) {
    for (const [gasIndex, gasType] of gasTypes.entries()) {
      const calibratedAt = new Date(now);
      calibratedAt.setDate(now.getDate() - ((deviceIndex + gasIndex) % 36));
      const nextDueAt = new Date(calibratedAt);
      nextDueAt.setDate(calibratedAt.getDate() + 30);
      const standardValue = gasType === GasType.O2 ? 20.9 : gasType === GasType.CH4 ? 1 : gasType === GasType.CO ? 24 : 10;
      const afterValue = deviceIndex % 5 === 0 ? standardValue * 1.24 : deviceIndex % 4 === 0 ? standardValue * 1.14 : standardValue * 1.04;
      const deviationPercent = Number((Math.abs(afterValue - standardValue) / Math.abs(standardValue) * 100).toFixed(2));
      const result = deviationPercent > 20
        ? CalibrationResult.FAIL
        : deviationPercent > 10
          ? CalibrationResult.NEED_RECHECK
          : CalibrationResult.PASS;
      const person = personnel.length > 0 ? personnel[(deviceIndex + gasIndex) % personnel.length] : undefined;
      const team = teams.length > 0 ? teams[(deviceIndex + gasIndex) % teams.length] : undefined;

      await prisma.calibrationRecord.upsert({
        where: { id: `${device.code}-${gasType}-demo` },
        update: {
          beforeValue: standardValue * 0.95,
          afterValue,
          standardValue,
          calibratedBy: person?.name ?? '系统示例',
          calibratedById: person?.id ?? null,
          teamId: team?.id ?? null,
          result,
          deviationPercent,
          nextDueAt,
          notes: '种子演示标定记录',
          calibratedAt,
        },
        create: {
          id: `${device.code}-${gasType}-demo`,
          deviceId: device.id,
          gasType,
          beforeValue: standardValue * 0.95,
          afterValue,
          standardValue,
          calibratedBy: person?.name ?? '系统示例',
          calibratedById: person?.id ?? null,
          teamId: team?.id ?? null,
          result,
          deviationPercent,
          nextDueAt,
          notes: '种子演示标定记录',
          calibratedAt,
        },
      });
    }
  }
}

async function main() {
  await seedRolesAndPermissions();
  const { areas, baseStations } = await seedAreasAndBaseStations();
  await seedDevices(areas, baseStations);
  await seedAlarmRules();
  await seedCalibrationRecords();
}

main()
  .then(async () => {
    console.log('Seed completed: admin user, roles, permissions, areas, base stations, devices, snapshots, alarm rules, calibration records.');
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
