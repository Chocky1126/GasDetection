const DEFAULT_DATABASE_URL = 'postgresql://gas_user:gas_password@localhost:5432/gas_detection?schema=public';

export function validateEnv(config: Record<string, unknown>) {
  const apiPort = Number(config.API_PORT ?? 3000);

  return {
    ...config,
    NODE_ENV: String(config.NODE_ENV ?? 'development'),
    DATABASE_URL: String(config.DATABASE_URL ?? DEFAULT_DATABASE_URL),
    REDIS_URL: String(config.REDIS_URL ?? 'redis://localhost:6379'),
    MQTT_URL: String(config.MQTT_URL ?? 'mqtt://localhost:1883'),
    JWT_SECRET: String(config.JWT_SECRET ?? 'local-dev-secret-change-me'),
    JWT_EXPIRES_IN: String(config.JWT_EXPIRES_IN ?? '8h'),
    API_PORT: Number.isFinite(apiPort) ? apiPort : 3000,
  };
}
