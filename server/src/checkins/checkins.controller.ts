import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckInDto } from './checkins.dto';

// One small insert per answer; no polling, no computation here (the desktop app decides when to ask).
@ApiTags('checkins')
@ApiBearerAuth('access-token')
@Controller('checkins')
@UseGuards(JwtAuthGuard)
export class CheckInsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar un check-in (energía, siesta, intensidad del ejercicio, avance)' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCheckInDto) {
    const userId = req.user.userId;
    const data = {
      at: new Date(dto.at),
      kind: dto.kind,
      energy: dto.energy ?? null,
      napped: dto.napped ?? null,
      exerciseIntensity: dto.exerciseIntensity ?? null,
      progress: dto.progress ?? null,
      reason: dto.reason ?? null,
      note: dto.note ?? null,
    };
    return this.prisma.checkIn.upsert({
      where: { userId_clientId: { userId, clientId: dto.clientId } },
      create: { ...data, userId, clientId: dto.clientId },
      update: data,
    });
  }
}
