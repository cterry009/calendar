import { DevicePlatform } from '@prisma/client';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  deviceId: string;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  deviceId: string;
  type: 'refresh';
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  deviceId: string;
}

export interface DeviceInfo {
  label: string;
  platform: DevicePlatform;
}
