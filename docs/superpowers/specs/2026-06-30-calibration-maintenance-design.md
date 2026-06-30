# 设备标定维护闭环设计

## 目标

在现有气体检测平台 MVP 上补齐设备标定和维护管理闭环，让标定从“人工录入一条记录”升级为“发现到期、执行标定、自动判定、沉淀设备历史、留下审计”的可演示业务流程。

本轮仍然不接真实硬件标定指令，不做短信、电话、企业微信等外部通知，也不做复杂工单派发。所有标定动作均为后台人工录入和系统自动判定。

## 当前基础

已有能力：

- `CalibrationRecord` 保存标定记录，包含设备、气体、标准值、标定前后值、标定人、结果、备注和时间。
- `Device` 已关联标定记录。
- `Personnel`、`Team` 已能维护人员和班组。
- `AuditLog` 已能查询操作日志。
- 管理后台已有标定记录菜单，但当前页面只是通用表格。

主要短板：

- 标定记录没有结构化结果，不能稳定筛选合格、需复检、失败。
- 标定人和班组只靠文本，无法和人员/班组管理形成关系。
- 没有标定周期、下次标定时间、即将到期、超期等视图。
- 创建设备标定记录不会自动写操作日志。
- 设备详情没有标定历史和最近标定状态。

## 方案选择

采用“维护闭环版”：

1. 标定工作台展示待标定、即将到期、超期、失败、今日完成等指标。
2. 新增标定记录时选择设备、气体、标定人员、班组，录入标准值、标定前值、标定后值、备注。
3. 后端根据标定后值和标准值自动计算偏差并判定结果。
4. 标定记录进入设备详情，形成按设备维度可追踪的标定历史。
5. 标定创建和异常结果写入操作日志。

## 标定判定规则

本轮把判定规则固化为后端常量。未来如果需要按矿区或设备型号配置阈值，再增加系统配置模块。

- 标定周期默认 `30` 天。
- 需要标定的气体为 `CH4`、`O2`、`CO`、`H2S`；`BATTERY` 不参与标定到期计算。
- 偏差率计算：`abs(afterValue - standardValue) / abs(standardValue) * 100`。
- 若 `standardValue = 0`，使用绝对偏差 `abs(afterValue - standardValue)`，并按阈值 `0.1` 和 `0.2` 判定。
- 偏差率 `<= 10%`：`PASS`，合格。
- 偏差率 `> 10%` 且 `<= 20%`：`NEED_RECHECK`，需复检。
- 偏差率 `> 20%`：`FAIL`，失败。
- `nextDueAt = calibratedAt + 30 天`。

## 到期状态规则

到期状态按“设备 + 气体”维度计算，便于发现某台设备的某个传感器需要标定。

- 没有任何标定记录：`OVERDUE`。
- 最新标定结果为 `FAIL` 或 `NEED_RECHECK`：`FAILED`。
- `nextDueAt < now`：`OVERDUE`。
- `nextDueAt` 距当前时间 `<= 7` 天：`DUE_SOON`。
- 其他情况：`NORMAL`。

状态优先级为：`FAILED > OVERDUE > DUE_SOON > NORMAL`。

## 数据模型

新增枚举：

```prisma
enum CalibrationResult {
  PASS
  NEED_RECHECK
  FAIL
}
```

扩展 `CalibrationRecord`：

```prisma
model CalibrationRecord {
  id               String            @id @default(cuid())
  deviceId         String
  device           Device            @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  gasType          GasType
  beforeValue      Float
  afterValue       Float
  standardValue    Float
  calibratedBy     String
  calibratedById   String?
  calibratedByUser Personnel?        @relation(fields: [calibratedById], references: [id])
  teamId           String?
  team             Team?             @relation(fields: [teamId], references: [id])
  result           CalibrationResult
  deviationPercent Float
  nextDueAt        DateTime
  notes            String?
  calibratedAt     DateTime
  createdAt        DateTime          @default(now())

  @@index([deviceId, calibratedAt])
  @@index([gasType])
  @@index([result])
  @@index([nextDueAt])
  @@index([teamId])
  @@index([calibratedById])
}
```

为关系增加反向字段：

```prisma
model Personnel {
  calibrations CalibrationRecord[]
}

model Team {
  calibrations CalibrationRecord[]
}
```

迁移兼容：

- 旧 `result String` 改为枚举字段时，需要给已有数据提供默认映射。
- 对已有文本结果，无法可靠识别时按 `PASS` 迁移，并由后续新记录使用自动判定。
- `calibratedBy` 文本保留，用于展示历史姓名和兼容手动输入。

## 后端接口

新增和增强接口均沿用 `/api/v1` 前缀。

```text
GET /calibrations
```

列表筛选参数：

- `deviceId`
- `gasType`
- `result`
- `teamId`
- `calibratedById`
- `dueStatus`: `NORMAL | DUE_SOON | OVERDUE | FAILED`
- `keyword`
- `page`
- `pageSize`

返回标定记录，包含设备、区域、基站、人员、班组。

```text
GET /calibrations/overview
```

返回：

```ts
{
  totalRecords: number;
  todayCompleted: number;
  dueSoonItems: number;
  overdueItems: number;
  failedRecords: number;
  needRecheckRecords: number;
}
```

```text
GET /calibrations/due-devices
```

返回按设备和气体聚合后的到期列表：

```ts
{
  deviceId: string;
  deviceCode: string;
  deviceName: string;
  gasType: GasType;
  areaName?: string;
  baseStationName?: string;
  latestCalibration?: CalibrationRecord;
  nextDueAt?: string;
  dueStatus: 'NORMAL' | 'DUE_SOON' | 'OVERDUE' | 'FAILED';
}
```

```text
POST /calibrations
```

请求：

```ts
{
  deviceId: string;
  gasType: GasType;
  beforeValue: number;
  afterValue: number;
  standardValue: number;
  calibratedById?: string;
  teamId?: string;
  calibratedBy?: string;
  notes?: string;
  calibratedAt: string;
}
```

后端行为：

- 校验设备存在。
- 若传入 `calibratedById`，读取人员姓名写入 `calibratedBy`。
- 若只传入 `calibratedBy` 文本，也允许创建。
- 自动计算 `result`、`deviationPercent`、`nextDueAt`。
- 创建标定记录。
- 写入 `AuditLog`：`module = calibrations`，`action = CREATE`。
- 若结果是 `NEED_RECHECK` 或 `FAIL`，额外写入一条 `AuditLog`：`action = CALIBRATION_WARNING`。

```text
GET /devices/:id/calibrations
```

返回设备标定历史，按 `calibratedAt desc` 排序，并支持 `gasType` 筛选。

## 后台页面

### 标定工作台

替换当前通用 `CalibrationsView.vue`，页面包含：

- 顶部统计卡：标定记录、今日完成、即将到期、已超期、需复检、失败。
- 筛选区：设备关键词、气体类型、结果、到期状态、班组。
- 表格字段：设备、区域、气体、标准值、标定前、标定后、偏差、结果、下次标定、标定人、班组。
- 新增标定按钮。
- 详情抽屉：设备信息、标定记录详情、操作日志摘要。

### 新增标定弹窗

字段：

- 设备选择。
- 气体类型。
- 标定人员。
- 班组。
- 标准值。
- 标定前值。
- 标定后值。
- 标定时间。
- 备注。

提交后：

- 调用 `POST /calibrations`。
- 刷新列表和统计。
- 如果结果为 `FAIL` 或 `NEED_RECHECK`，显示醒目反馈。

### 设备详情

在 `DevicesView.vue` 的设备抽屉中增加“标定历史”区域：

- 最近 5 条标定记录。
- 每条显示气体、结果、偏差、标定时间、标定人。
- 若有失败或超期记录，用标签提示。

## 大屏影响

本轮不改大屏。标定闭环先集中在管理后台、后端接口、设备详情和操作审计，避免把一次迭代拉得过宽。

未来如果要把标定风险纳入大屏，可以在区域风险排行中加入 `calibrationFailedItems` 权重；该项不属于本轮交付范围。

## 操作日志

新增审计写入点：

- 创建标定记录：`module = calibrations`，`action = CREATE`。
- 标定需复检或失败：`module = calibrations`，`action = CALIBRATION_WARNING`。

日志详情建议格式：

```text
设备 GAS-0001 CH4 标定完成：标准值 1.0，标定后 1.08，偏差 8.00%，结果 PASS
```

## 错误处理

- 设备不存在：404。
- 标定人员不存在：400。
- 班组不存在：400。
- 标准值、标定前值、标定后值不是数字：400。
- `calibratedAt` 不是合法日期：400。
- `standardValue = 0` 时按绝对偏差规则处理，不报错。

## 测试策略

后端：

- `CalibrationsService` 单测覆盖自动判定、偏差计算、`nextDueAt`、审计日志、异常输入。
- `CalibrationsService` 单测覆盖列表筛选、工作台统计、设备到期聚合。
- `DevicesService` 或控制器单测覆盖设备标定历史。

前端：

- 以 `vue-tsc` 和生产构建保障类型和模板。
- 不新增前端单测，保持当前仓库测试策略一致。

集成验证：

- `pnpm prisma:generate`
- `pnpm -r typecheck`
- `pnpm -r test`
- `pnpm -r build`
- `./scripts/docker-up.sh`
- 登录后台后访问标定工作台、创建设备标定记录、查看设备标定历史、查看操作日志。

## 成功标准

- 能在后台看到标定工作台统计和到期/异常设备。
- 能新增一条设备标定记录，系统自动给出 `PASS`、`NEED_RECHECK` 或 `FAIL`。
- 标定记录能关联人员和班组。
- 设备详情能显示标定历史。
- 创建标定记录和异常结果会写入操作日志。
- Docker Compose 一键启动后相关接口和页面可访问。
