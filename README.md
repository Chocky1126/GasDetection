# 井下四合一气体检测仪管理后台与数据大屏平台

第一阶段 MVP 已覆盖模拟设备、MQTT 接入、NestJS 后端、PostgreSQL/Prisma、Redis、WebSocket、管理后台、数据大屏和 Docker Compose 运行配置。

## 技术栈

- 后端：NestJS、Prisma、PostgreSQL、Redis、MQTT.js、Socket.IO、Swagger
- 管理后台：Vue 3、Vite、Element Plus、Pinia、Socket.IO Client
- 数据大屏：Vue 3、Vite、ECharts、Pinia、Socket.IO Client
- 模拟器：Node.js、MQTT.js
- 部署：Docker Compose、Mosquitto、Nginx

## 目录结构

```text
apps/api          NestJS API
apps/admin-web    管理后台
apps/screen-web   数据大屏
apps/simulator    100 台设备 MQTT 模拟器
packages/shared   共享枚举和常量
prisma            数据库模型和 seed
docker            Mosquitto 与 Nginx 配置
docs              设计、计划和接口示例
```

## 默认账号

```text
用户名：admin
密码：admin123456
```

## Docker Compose 一键启动

```bash
cp .env.example .env
docker compose up --build
```

也可以使用带环境检查的一键脚本：

```bash
./scripts/docker-up.sh
```

服务地址：

```text
Swagger:    http://localhost:3000/api/docs
API:        http://localhost:3000/api/v1
管理后台:   http://localhost:8080
数据大屏:   http://localhost:8081
MQTT:       mqtt://localhost:1883
PostgreSQL: localhost:5432
Redis:      localhost:6379
```

API 容器启动时会执行：

```bash
pnpm prisma db push --schema prisma/schema.prisma
pnpm prisma:seed
```

如果构建卡在依赖下载，可以在 `.env` 中调整镜像源：

```text
NPM_REGISTRY=https://registry.npmmirror.com
PNPM_VERSION=11.7.0
```

## 本地开发

```bash
pnpm install
pnpm prisma:generate
pnpm dev:api
pnpm dev:admin
pnpm dev:screen
pnpm dev:simulator
```

如果本地使用 Docker 只启动基础设施：

```bash
docker compose up -d postgres redis mosquitto
DATABASE_URL=postgresql://gas_user:gas_password@localhost:5432/gas_detection?schema=public pnpm prisma db push --schema prisma/schema.prisma
DATABASE_URL=postgresql://gas_user:gas_password@localhost:5432/gas_detection?schema=public pnpm prisma:seed
```

## 验证命令

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

## 实时链路

```text
simulator -> Mosquitto MQTT -> apps/api MQTT consumer
apps/api -> PostgreSQL telemetry/history
apps/api -> Redis latest snapshot cache
apps/api -> Socket.IO /realtime
admin-web + screen-web -> realtime refresh
```

MQTT Topic：

```text
gas/devices/{deviceCode}/telemetry
gas/devices/{deviceCode}/status
gas/devices/{deviceCode}/fault
gas/devices/{deviceCode}/alarm
```

WebSocket namespace：

```text
/realtime
```

主要事件：

```text
device.snapshot.updated
telemetry.created
alarm.created
alarm.updated
device.status.changed
screen.overview.updated
```
