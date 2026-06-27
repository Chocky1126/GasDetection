import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  async function createService(password = 'admin123456') {
    const passwordHash = await bcrypt.hash(password, 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'admin',
          name: '系统管理员',
          passwordHash,
          isEnabled: true,
          roles: [
            {
              role: {
                name: 'admin',
                permissions: [
                  {
                    permission: {
                      code: 'devices:read',
                    },
                  },
                ],
              },
            },
          ],
        }),
      },
    } as unknown as PrismaService;

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    } as unknown as JwtService;

    return {
      service: new AuthService(prisma, jwt),
      prisma,
      jwt,
    };
  }

  it('returns token, roles, and permissions for valid credentials', async () => {
    const { service, jwt } = await createService();

    const result = await service.login({ username: 'admin', password: 'admin123456' });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user.username).toBe('admin');
    expect(result.user.roles).toEqual(['admin']);
    expect(result.user.permissions).toEqual(['devices:read']);
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      username: 'admin',
      roles: ['admin'],
      permissions: ['devices:read'],
    });
  });

  it('rejects an invalid password', async () => {
    const { service } = await createService();

    await expect(service.login({ username: 'admin', password: 'wrong' })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
