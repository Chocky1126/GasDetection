export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  FAULT = 'FAULT',
}

export enum SensorStatus {
  NORMAL = 'NORMAL',
  FAULT = 'FAULT',
}

export enum GasType {
  CH4 = 'CH4',
  O2 = 'O2',
  CO = 'CO',
  H2S = 'H2S',
  BATTERY = 'BATTERY',
}

export enum AlarmSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlarmStatus {
  ACTIVE = 'ACTIVE',
  ACKED = 'ACKED',
  RESOLVED = 'RESOLVED',
}

export enum RuleOperator {
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  EQ = 'EQ',
}
