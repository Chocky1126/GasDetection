# 井下四合一气体检测仪管理后台与数据大屏平台设计

## 目标

第一阶段从零搭建一个可本地一键启动的全链路 MVP：模拟 100 台井下四合一气体检测仪通过 MQTT 周期性上报 CH4、O2、CO、H2S、电量、定位坐标、在线状态和故障/报警事件；NestJS 后端消费数据、入库、计算报警、维护实时快照，并通过 WebSocket 推送管理后台和数据大屏。

## 第一阶段范围

包含：

- NestJS + PostgreSQL + Prisma + Redis + MQTT + WebSocket 后端。
- Vue3 + Vite + Element Plus 管理后台。
- Vue3 + Vite + ECharts 数据大屏。
- MQTT 模拟设备数据工具，默认模拟 100 台设备。
- 用户登录、JWT 鉴权和角色权限。
- 设备管理、实时监测、报警规则、报警中心、人员班组、区域基站、标定记录、操作日志。
- 大屏模块：设备总览、井下地图、实时报警、气体趋势、设备状态分布、区域风险排行。
- Swagger 接口文档。
- Docker Compose 一键启动 PostgreSQL、Redis、Mosquitto、API、后台、大屏和模拟器。

不包含：

- 真实硬件协议适配。
- 复杂 GIS 地图引擎。
- 短信、电话、企业微信等外部报警通知。
- 多矿区、多租户、时报/日报/月报。

## 推荐方案

采用 pnpm monorepo：

```text
气体检测硬件/
  apps/
    api/                 # NestJS 后端
    admin-web/           # Vue3 + Vite + Element Plus 管理后台
    screen-web/          # Vue3 + Vite + ECharts 数据大屏
    simulator/           # MQTT 模拟设备数据工具
  packages/
    shared/              # DTO、枚举、类型、常量
  prisma/
    schema.prisma
    seed.ts
  docker/
    mosquitto/
      mosquitto.conf
    nginx/
  docs/
    api/
    superpowers/
      specs/
      plans/
  docker-compose.yml
  pnpm-workspace.yaml
  package.json
  .env.example
```

后端作为唯一业务入口，前端通过 REST 获取列表/配置/历史数据，通过 WebSocket 订阅实时变化。模拟器只和 MQTT Broker 通信，不直接写数据库。

## 数据流

1. `apps/simulator` 启动后生成 100 台模拟设备状态。
2. 模拟器定时向 `gas/devices/{deviceCode}/telemetry` 发布遥测数据。
3. 模拟器随机发布离线、低电量、传感器故障和报警事件。
4. `apps/api` 订阅 MQTT Topic，校验消息并写入 `TelemetryRecord`。
5. API 更新 `DeviceSnapshot`，将最新快照同步到 Redis。
6. API 根据 `AlarmRule` 计算报警，生成或更新 `AlarmEvent`。
7. API 通过 WebSocket 推送设备快照、报警和统计变化。
8. 管理后台和数据大屏实时刷新。

## 数据库模型

核心模型：

```text
User
Role
Permission
UserRole
RolePermission
Device
DeviceSnapshot
TelemetryRecord
DeviceFault
AlarmRule
AlarmEvent
AlarmActionLog
Personnel
Team
PersonnelTeam
Area
BaseStation
CalibrationRecord
AuditLog
```

关键关系：

```text
Device -> Area
Device -> BaseStation
Device -> DeviceSnapshot
Device -> TelemetryRecord[]
Device -> AlarmEvent[]
DeviceFault -> Device
AlarmRule -> AlarmEvent[]
AlarmActionLog -> AlarmEvent
AlarmActionLog -> User
Personnel -> Team through PersonnelTeam
CalibrationRecord -> Device
AuditLog -> User
```

关键枚举：

```text
DeviceStatus: ONLINE, OFFLINE, FAULT
SensorStatus: NORMAL, FAULT
GasType: CH4, O2, CO, H2S, BATTERY
AlarmSeverity: LOW, MEDIUM, HIGH, CRITICAL
AlarmStatus: ACTIVE, ACKED, RESOLVED
RuleOperator: GT, GTE, LT, LTE, EQ
```

`TelemetryRecord` 字段：

```text
id
deviceId
ch4
o2
co
h2s
batteryLevel
lng
lat
depth
onlineStatus
sensorStatus
reportedAt
createdAt
```

`DeviceSnapshot` 字段：

```text
id
deviceId
ch4
o2
co
h2s
batteryLevel
lng
lat
depth
status
sensorStatus
lastSeenAt
updatedAt
```

`AlarmRule` 字段：

```text
id
name
gasType
operator
thresholdValue
severity
durationSeconds
enabled
createdAt
updatedAt
```

`AlarmEvent` 字段：

```text
id
deviceId
ruleId
gasType
severity
status
value
thresholdValue
message
startedAt
ackedAt
resolvedAt
createdAt
updatedAt
```

## REST 接口

统一前缀：`/api/v1`。Swagger：`/api/docs`。

```text
POST   /auth/login
GET    /auth/profile

GET    /users
POST   /users
PATCH  /users/:id
DELETE /users/:id

GET    /roles
POST   /roles
PATCH  /roles/:id
DELETE /roles/:id

GET    /devices
POST   /devices
GET    /devices/:id
PATCH  /devices/:id
DELETE /devices/:id
GET    /devices/:id/telemetry
GET    /devices/:id/alarms

GET    /monitor/snapshots
GET    /monitor/trends
GET    /monitor/status-distribution
GET    /monitor/area-risk-ranking
GET    /monitor/overview

GET    /alarm-rules
POST   /alarm-rules
PATCH  /alarm-rules/:id
DELETE /alarm-rules/:id

GET    /alarms
GET    /alarms/:id
PATCH  /alarms/:id/ack
PATCH  /alarms/:id/resolve

GET    /personnel
POST   /personnel
PATCH  /personnel/:id
DELETE /personnel/:id

GET    /teams
POST   /teams
PATCH  /teams/:id
DELETE /teams/:id

GET    /areas
POST   /areas
PATCH  /areas/:id
DELETE /areas/:id

GET    /base-stations
POST   /base-stations
PATCH  /base-stations/:id
DELETE /base-stations/:id

GET    /calibrations
POST   /calibrations
GET    /audit-logs
```

## WebSocket 事件

命名空间：`/realtime`。

服务端推送：

```text
device.snapshot.updated
telemetry.created
alarm.created
alarm.updated
device.status.changed
screen.overview.updated
screen.metrics.updated
```

客户端订阅消息：

```text
subscribe.monitor
subscribe.screen
unsubscribe.monitor
unsubscribe.screen
```

第一阶段允许前端连接后默认接收全局实时事件，后续再按区域、设备或权限过滤。

## MQTT Topic

```text
gas/devices/{deviceCode}/telemetry
gas/devices/{deviceCode}/status
gas/devices/{deviceCode}/fault
gas/devices/{deviceCode}/alarm
```

遥测 payload：

```json
{
  "deviceCode": "GAS-0001",
  "ch4": 0.42,
  "o2": 20.7,
  "co": 12,
  "h2s": 3,
  "batteryLevel": 86,
  "lng": 112.931,
  "lat": 28.234,
  "depth": -420,
  "onlineStatus": "ONLINE",
  "sensorStatus": "NORMAL",
  "reportedAt": "2026-06-27T10:00:00.000Z"
}
```

## 管理后台页面

```text
/login
/dashboard
/devices
/monitor
/alarm-rules
/alarms
/personnel
/teams
/areas
/base-stations
/calibrations
/audit-logs
/system/users
/system/roles
```

后台视觉风格应偏工作台：信息密度适中、侧边栏导航、顶部状态栏、列表筛选、表格、抽屉/弹窗编辑。第一阶段重实用，不做营销式首页。

## 数据大屏页面

单页 `/screen`，包括：

- 顶部设备总览指标：设备总数、在线、报警、故障、低电量。
- 中央井下地图：以区域、基站、设备点位呈现，第一阶段用二维示意地图。
- 左侧实时报警列表。
- 右侧设备状态分布、区域风险排行。
- 底部气体趋势图：CH4、O2、CO、H2S。

## 默认数据

Seed 数据：

- 默认管理员：admin / admin123456。
- 默认角色：admin、operator、viewer。
- 默认权限覆盖第一阶段所有模块。
- 5 个区域，10 个基站。
- 4 个默认报警规则：
  - CH4 >= 1.0，HIGH。
  - O2 <= 19.5，HIGH。
  - CO >= 24，MEDIUM。
  - H2S >= 10，MEDIUM。
- 100 台设备，编码 `GAS-0001` 到 `GAS-0100`。

## 测试和验收

基础验收：

- `docker compose up --build` 可以启动所有服务。
- Swagger 可访问 `/api/docs`。
- 使用 admin 账号能登录后台。
- 设备列表显示 100 台设备。
- 模拟器持续发布遥测数据。
- 后端能消费 MQTT 并写入 PostgreSQL。
- WebSocket 能推送实时设备快照和报警。
- 后台实时监测页面能刷新数据。
- 大屏能显示总览、趋势、报警和状态分布。

开发验收：

- API 至少包含健康检查、鉴权、核心 CRUD 和监测聚合接口测试。
- 模拟器包含数据范围和异常事件生成测试。
- 前端能通过构建检查。

## 开发顺序

1. 初始化 monorepo、workspace、基础脚本、Docker Compose。
2. 搭建 NestJS API、Prisma、PostgreSQL、Redis、Swagger。
3. 建立数据库模型、迁移、seed 默认数据。
4. 实现 Auth + JWT + RBAC。
5. 实现基础业务 CRUD。
6. 实现 MQTT 消费和遥测处理。
7. 实现报警规则计算和报警中心。
8. 实现 WebSocket 实时推送。
9. 实现模拟器。
10. 实现管理后台。
11. 实现数据大屏。
12. 补充 README、启动说明和验证命令。
