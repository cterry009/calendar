import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { DevicePlatform } from '@prisma/client';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthResponse,
  AuthTokens,
  DeviceInfo,
  JwtAccessPayload,
  JwtRefreshPayload,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly bcryptRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    this.accessSecret = configService.getOrThrow<string>('auth.accessSecret');
    this.refreshSecret = configService.getOrThrow<string>('auth.refreshSecret');
    this.accessExpiresIn = configService.getOrThrow<string>(
      'auth.accessExpiresIn',
    );
    this.refreshExpiresIn = configService.getOrThrow<string>(
      'auth.refreshExpiresIn',
    );
    this.bcryptRounds = configService.getOrThrow<number>('auth.bcryptRounds');
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name ?? null,
      },
    });

    return this.createSession(user, {
      label: dto.deviceLabel,
      platform: dto.devicePlatform,
    });
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user, {
      label: dto.deviceLabel ?? 'Web browser',
      platform: dto.devicePlatform ?? DevicePlatform.WEB,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        { secret: this.refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const device = await this.prisma.device.findUnique({
      where: { id: payload.deviceId },
      include: { user: true },
    });

    if (
      !device ||
      device.userId !== payload.sub ||
      device.revokedAt ||
      !device.refreshToken
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenValid = this.verifyRefreshTokenHash(
      refreshToken,
      device.refreshToken,
    );
    if (!tokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    const tokens = await this.issueTokens(device.user, device.id);

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        refreshToken: this.hashRefreshToken(tokens.refreshToken),
        lastSeenAt: new Date(),
      },
    });

    return tokens;
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId, revokedAt: null },
    });

    if (!device) {
      return;
    }

    await this.prisma.device.update({
      where: { id: device.id },
      data: {
        revokedAt: new Date(),
        refreshToken: null,
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async createSession(
    user: { id: string; email: string; name: string | null },
    deviceInfo: DeviceInfo,
  ): Promise<AuthResponse> {
    const device = await this.prisma.device.create({
      data: {
        userId: user.id,
        label: deviceInfo.label,
        platform: deviceInfo.platform,
      },
    });

    return this.buildAuthResponse(user, device.id);
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    await this.logout(userId, deviceId);
  }

  private async buildAuthResponse(
    user: { id: string; email: string; name: string | null },
    deviceId: string,
  ): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user, deviceId);

    await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        refreshToken: this.hashRefreshToken(tokens.refreshToken),
        lastSeenAt: new Date(),
      },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      deviceId,
    };
  }

  private async issueTokens(
    user: { id: string; email: string; name: string | null },
    deviceId: string,
  ): Promise<AuthTokens> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      deviceId,
      type: 'access',
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      deviceId,
      type: 'refresh',
      jti: randomUUID(),
    };

    const accessOptions: JwtSignOptions = {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn as JwtSignOptions['expiresIn'],
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn as JwtSignOptions['expiresIn'],
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, accessOptions),
      this.jwtService.signAsync(refreshPayload, refreshOptions),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresIn,
    };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private verifyRefreshTokenHash(token: string, storedHash: string): boolean {
    const computed = this.hashRefreshToken(token);
    try {
      return timingSafeEqual(
        Buffer.from(computed, 'utf8'),
        Buffer.from(storedHash, 'utf8'),
      );
    } catch {
      return false;
    }
  }
}
