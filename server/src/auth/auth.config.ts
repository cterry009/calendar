import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
}));
