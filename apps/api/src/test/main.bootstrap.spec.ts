import { NestFactory } from '@nestjs/core';

const app = {
  setGlobalPrefix: jest.fn(),
  enableCors: jest.fn(),
  useGlobalPipes: jest.fn(),
  useGlobalFilters: jest.fn(),
  useGlobalInterceptors: jest.fn(),
  get: jest.fn().mockReturnValue({ get: jest.fn().mockReturnValue(3000) }),
  listen: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@nestjs/core', () => {
  const actual = jest.requireActual('@nestjs/core');
  return {
    ...actual,
    NestFactory: {
      create: jest.fn(),
    },
  };
});

jest.mock('@nestjs/swagger', () => {
  const actual = jest.requireActual('@nestjs/swagger');
  return {
    ...actual,
    SwaggerModule: {
      createDocument: jest.fn().mockReturnValue({}),
      setup: jest.fn(),
    },
  };
});

describe('API bootstrap', () => {
  it('relies on AppModule for the global filter and response interceptor', async () => {
    (NestFactory.create as jest.Mock).mockResolvedValue(app);
    await import('../main');
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(NestFactory.create).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledWith(3000);
    expect(app.useGlobalFilters).not.toHaveBeenCalled();
    expect(app.useGlobalInterceptors).not.toHaveBeenCalled();
  });
});
