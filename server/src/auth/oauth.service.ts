import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicePlatform } from '@prisma/client';
import appleSignin from 'apple-signin-auth';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthResponse } from './auth.types';
import { OAuthAppleDto, OAuthGoogleDto } from './dto/oauth.dto';

@Injectable()
export class OAuthService {
  private readonly googleClientId: string;
  private readonly appleClientId: string;
  private readonly googleClient: OAuth2Client | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.googleClientId = configService.get<string>('auth.googleClientId') ?? '';
    this.appleClientId = configService.get<string>('auth.appleClientId') ?? '';
    this.googleClient = this.googleClientId
      ? new OAuth2Client(this.googleClientId)
      : null;
  }

  async loginWithGoogle(dto: OAuthGoogleDto): Promise<AuthResponse> {
    if (!this.googleClient) {
      throw new ServiceUnavailableException('Google OAuth is not configured');
    }

    let payload: { sub: string; email?: string; name?: string };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: this.googleClientId,
      });
      const verified = ticket.getPayload();
      if (!verified?.sub || !verified.email) {
        throw new UnauthorizedException('Invalid Google token');
      }
      payload = {
        sub: verified.sub,
        email: verified.email,
        name: verified.name,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Google token');
    }

    const user = await this.findOrCreateOAuthUser({
      email: payload.email!,
      name: payload.name ?? null,
      googleId: payload.sub,
    });

    return this.authService.createSession(user, {
      label: dto.deviceLabel ?? 'Google sign-in',
      platform: dto.devicePlatform ?? DevicePlatform.WEB,
    });
  }

  async loginWithApple(dto: OAuthAppleDto): Promise<AuthResponse> {
    if (!this.appleClientId) {
      throw new ServiceUnavailableException('Apple OAuth is not configured');
    }

    let payload: { sub: string; email?: string };
    try {
      payload = await appleSignin.verifyIdToken(dto.idToken, {
        audience: this.appleClientId,
        ignoreExpiration: false,
      });
    } catch {
      throw new UnauthorizedException('Invalid Apple token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid Apple token');
    }

    const user = await this.findOrCreateOAuthUser({
      email: payload.email,
      name: null,
      appleId: payload.sub,
    });

    return this.authService.createSession(user, {
      label: dto.deviceLabel ?? 'Apple sign-in',
      platform: dto.devicePlatform ?? DevicePlatform.WEB,
    });
  }

  private async findOrCreateOAuthUser(input: {
    email?: string;
    name: string | null;
    googleId?: string;
    appleId?: string;
  }) {
    if (input.googleId) {
      const byGoogle = await this.prisma.user.findUnique({
        where: { googleId: input.googleId },
      });
      if (byGoogle) {
        return byGoogle;
      }
    }

    if (input.appleId) {
      const byApple = await this.prisma.user.findUnique({
        where: { appleId: input.appleId },
      });
      if (byApple) {
        return byApple;
      }
    }

    if (input.email) {
      const byEmail = await this.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
      });
      if (byEmail) {
        return this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: input.googleId ?? byEmail.googleId,
            appleId: input.appleId ?? byEmail.appleId,
            name: byEmail.name ?? input.name,
          },
        });
      }
    }

    if (!input.email) {
      throw new UnauthorizedException(
        'Apple account email unavailable; sign in with Apple again',
      );
    }

    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        googleId: input.googleId ?? null,
        appleId: input.appleId ?? null,
      },
    });
  }
}
