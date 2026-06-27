import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser, JwtPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isEnabled) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const roles = user.roles.map((item) => item.role.name);
    const permissions = [...new Set(user.roles.flatMap((item) => item.role.permissions.map((rolePermission) => rolePermission.permission.code)))];
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      roles,
      permissions,
    };
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles,
      permissions,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: authenticatedUser,
    };
  }
}
