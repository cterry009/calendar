import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  list(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        label: true,
        platform: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async register(userId: string, dto: RegisterDeviceDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    return this.authService.createSession(user, {
      label: dto.label,
      platform: dto.platform,
    });
  }

  async revoke(userId: string, deviceId: string, currentDeviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.revokedAt) {
      return;
    }

    if (deviceId === currentDeviceId) {
      throw new ForbiddenException('Cannot revoke the current device session');
    }

    await this.authService.revokeDevice(userId, deviceId);
  }
}
