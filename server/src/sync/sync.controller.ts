import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('pull')
  pull(@Req() req: AuthenticatedRequest) {
    return this.syncService.pullSnapshot(req.user.userId);
  }

  @Post('batch')
  batch(@Req() req: AuthenticatedRequest, @Body() dto: SyncBatchDto) {
    return this.syncService.processBatch(
      req.user.userId,
      req.user.deviceId,
      dto,
    );
  }
}
