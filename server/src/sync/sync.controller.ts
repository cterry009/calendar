import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth('access-token')
@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('pull')
  @ApiOperation({ summary: 'Descargar snapshot completo del usuario' })
  @ApiOkResponse({ description: 'Tareas, horarios, pomodoros, bloqueos y fitness' })
  pull(@Req() req: AuthenticatedRequest) {
    return this.syncService.pullSnapshot(req.user.userId);
  }

  @Get('focus-events')
  @ApiOperation({ summary: 'Eventos de foco desde una fecha (calificaciones, salidas, cortes)' })
  @ApiQuery({ name: 'since', required: false, description: 'ISO; por defecto, hace 90 días' })
  focusEvents(@Req() req: AuthenticatedRequest, @Query('since') since?: string) {
    const parsed = since ? new Date(since) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('since must be an ISO date');
    return this.syncService.listFocusEvents(req.user.userId, parsed);
  }

  @Get('exercise-attempts')
  @ApiOperation({ summary: 'Intentos de ejercicios con enunciado generado y feedback' })
  @ApiQuery({ name: 'since', required: false, description: 'ISO; sin él, toda la historia' })
  exerciseAttempts(@Req() req: AuthenticatedRequest, @Query('since') since?: string) {
    const parsed = since ? new Date(since) : undefined;
    if (parsed && Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('since must be an ISO date');
    }
    return this.syncService.listExerciseAttempts(req.user.userId, parsed);
  }

  @Post('batch')
  @ApiOperation({
    summary: 'Aplicar cambios offline con resolución de conflictos',
  })
  batch(@Req() req: AuthenticatedRequest, @Body() dto: SyncBatchDto) {
    return this.syncService.processBatch(
      req.user.userId,
      req.user.deviceId,
      dto,
    );
  }
}
