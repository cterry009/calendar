import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
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
