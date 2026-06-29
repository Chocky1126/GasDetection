# 报警闭环增强设计

## 目标

在已跑通的第一阶段 MVP 上增强报警中心，让报警从“产生和展示”推进到“确认、处置、解除、追踪、升级、统计”的闭环。第二阶段仍以本地 Docker Compose 可一键启动为边界，不接短信、电话、企业微信等外部通知。

## 范围

包含：

- 报警确认和解除时填写处置说明。
- 报警详情抽屉展示设备、规则、实时值、处置时间线。
- 报警动作日志记录 `ACK`、`RESOLVE`、`ESCALATE`。
- ACTIVE 报警超时未确认时自动升级。
- 新增报警统计接口，支持后台统计卡片和大屏风险权重。
- WebSocket 推送报警更新、升级和统计变化。

不包含：

- 外部通知渠道。
- 值班表、排班和通知人策略。
- 复杂规则编排或多级审批。
- 历史报表导出。

## 现状

当前系统已有：

- `AlarmEvent`：报警事件，状态为 `ACTIVE`、`ACKED`、`RESOLVED`。
- `AlarmActionLog`：动作日志，已关联报警和用户。
- `PATCH /alarms/:id/ack`：确认报警。
- `PATCH /alarms/:id/resolve`：解除报警。
- `RealtimeEvents.AlarmCreated` 和 `RealtimeEvents.AlarmUpdated`。
- 管理后台报警中心已有列表、确认、解除和实时刷新。

当前不足：

- 确认和解除不能填写处置说明。
- 前端看不到动作时间线。
- 报警超时未确认不会升级。
- 报警列表缺少筛选、统计和详情查看。
- 大屏风险排行没有体现升级报警的权重。

## 推荐方案

采用“实用闭环版”：保留现有 `AlarmEvent` 和 `AlarmActionLog`，只做必要字段扩展和服务增强。

原因：

- 复用已有模型和接口，迁移风险小。
- 能覆盖矿山现场最常见的处理流程。
- 后续接外部通知时，可以直接复用升级事件和动作日志。

## 数据模型

扩展 `AlarmEvent`：

```text
ackRemark        String?
resolveRemark    String?
escalatedAt      DateTime?
escalationLevel  Int       @default(0)
```

字段含义：

- `ackRemark`：确认时填写的说明，例如“已通知三采区巡检员复核”。
- `resolveRemark`：解除时填写的处置结果，例如“通风恢复，现场复测正常”。
- `escalatedAt`：最近一次自动升级时间。
- `escalationLevel`：升级次数，第一阶段只需要从 0 到 1，保留整数方便后续多级升级。

继续使用 `AlarmActionLog.remark` 保存每次动作备注。`ACK` 和 `RESOLVE` 动作的备注与 `AlarmEvent` 的当前备注保持一致；`ESCALATE` 备注记录升级原因。

## 后端接口

保持现有接口地址，扩展请求体：

```text
PATCH /api/v1/alarms/:id/ack
body: { remark?: string }

PATCH /api/v1/alarms/:id/resolve
body: { remark?: string }
```

新增接口：

```text
GET /api/v1/alarms/statistics
```

返回：

```text
{
  byStatus: { ACTIVE: number, ACKED: number, RESOLVED: number },
  bySeverity: { LOW: number, MEDIUM: number, HIGH: number, CRITICAL: number },
  byGasType: { CH4: number, O2: number, CO: number, H2S: number, BATTERY: number },
  escalatedActive: number,
  latestActive: AlarmEvent[]
}
```

扩展列表筛选：

```text
GET /api/v1/alarms?status=&severity=&gasType=&deviceId=&keyword=&page=&pageSize=
```

`GET /api/v1/alarms/:id` 返回 `device`、`rule`、`actions.user`，用于详情抽屉。

## 报警状态规则

状态流转：

```text
ACTIVE -> ACKED -> RESOLVED
ACTIVE -> RESOLVED
```

约束：

- 已解除报警不能再次确认或解除。
- ACKED 报警再次确认时不重复写 `ackedAt`，但可以追加一条 `ACK` 动作日志。
- 解除 ACTIVE 报警时允许直接解除，并记录解除说明。
- 自动升级只处理 `ACTIVE` 且 `escalationLevel = 0` 的报警。

## 自动升级

新增 `AlarmEscalationService`，由 NestJS 定时任务触发。

规则：

- 扫描 `ACTIVE` 报警。
- 若 `startedAt` 距当前时间超过规则配置的 `durationSeconds`，且未确认、未升级，则升级。
- 若规则没有配置有效 `durationSeconds`，默认使用 300 秒。
- 升级后设置：
  - `escalationLevel = 1`
  - `escalatedAt = now`
  - severity 至少提升一级，最高到 `CRITICAL`
  - 写入 `AlarmActionLog(action = "ESCALATE")`
  - 通过 WebSocket 推送 `alarm.updated`

说明：

- 第一阶段不做多级重复升级，避免后台频繁刷屏。
- 后续外部通知可订阅 `ESCALATE` 动作。

## 管理后台

报警中心增强：

- 顶部统计卡片：活动报警、已确认、已解除、升级中、严重/紧急报警。
- 筛选区：状态、等级、气体类型、关键字。
- 列表新增：
  - 升级标记。
  - 确认时间。
  - 解除时间。
  - 最近动作。
- 操作：
  - 确认：弹窗填写确认说明。
  - 解除：弹窗填写处置结果。
  - 详情：打开右侧抽屉。

详情抽屉内容：

- 设备基础信息。
- 报警规则和阈值。
- 当前报警值、开始时间、确认时间、解除时间。
- 动作时间线：动作、操作人、备注、时间。

## 数据大屏

本轮只做轻量联动：

- 实时报警列表展示升级标记。
- 区域风险排行计算时，升级报警权重高于普通 ACTIVE 报警。
- 收到 `alarm.updated` 和 `screen.overview.updated` 后刷新大屏数据。

## WebSocket

沿用现有事件：

```text
alarm.created
alarm.updated
screen.overview.updated
```

`alarm.updated` 负载需要包含：

```text
id
status
severity
escalationLevel
escalatedAt
ackedAt
resolvedAt
latestAction
```

前端收到后：

- 管理后台刷新当前报警列表和统计。
- 数据大屏刷新实时报警和区域风险排行。

## 错误处理

- 报警不存在：404。
- 已解除报警再确认或解除：400。
- remark 超过 500 字：400。
- 无权限：403。
- 自动升级扫描失败：记录日志，不影响 MQTT 入库和其他报警计算。

## 测试和验证

后端单测：

- 确认报警写入 `ackRemark` 和 `ACK` 动作日志。
- 解除报警写入 `resolveRemark` 和 `RESOLVE` 动作日志。
- 已解除报警不能再次确认。
- ACTIVE 超时报警自动升级并写入 `ESCALATE` 日志。
- 统计接口按状态、等级、气体类型返回聚合结果。

前端验证：

- 报警中心筛选可用。
- 确认和解除弹窗能提交备注。
- 详情抽屉展示动作时间线。
- WebSocket 更新后列表和统计刷新。

整体验证：

```bash
pnpm -r typecheck
pnpm -r test
pnpm -r build
./scripts/docker-up.sh
```

运行态验证：

- Docker Compose 所有容器保持 `Up`。
- 模拟器持续发布 100 台设备数据。
- 登录后访问报警列表、报警详情、报警统计接口返回 200。
- 管理后台和数据大屏可打开。

## 交付边界

本轮完成后，平台具备可演示的报警处置闭环：模拟设备触发报警，后台实时展示，值班员确认并填写说明，处置完成后解除报警，超时未确认的 ACTIVE 报警自动升级，大屏同步体现风险变化。
