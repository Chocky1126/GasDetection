import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client?: Redis;

  constructor(configService: ConfigService) {
    if (process.env.NODE_ENV !== 'test') {
      this.client = new Redis(configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) {
      return;
    }
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.client.set(key, value);
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.publish(channel, message);
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }
}
