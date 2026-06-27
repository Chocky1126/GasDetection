import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { ResponseInterceptor } from './common/response.interceptor';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { AlarmRulesModule } from './modules/alarm-rules/alarm-rules.module';
import { AlarmsModule } from './modules/alarms/alarms.module';
import { AreasModule } from './modules/areas/areas.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { BaseStationsModule } from './modules/base-stations/base-stations.module';
import { CalibrationsModule } from './modules/calibrations/calibrations.module';
import { DevicesModule } from './modules/devices/devices.module';
import { HealthModule } from './modules/health/health.module';
import { PersonnelModule } from './modules/personnel/personnel.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RedisModule } from './modules/redis/redis.module';
import { RolesModule } from './modules/roles/roles.module';
import { TeamsModule } from './modules/teams/teams.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '../../.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    DevicesModule,
    AlarmRulesModule,
    AlarmsModule,
    AreasModule,
    BaseStationsModule,
    TeamsModule,
    PersonnelModule,
    CalibrationsModule,
    AuditLogsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
