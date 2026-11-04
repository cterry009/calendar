import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { CommitmentController } from './commitment.controller';
import { CommitmentService } from './commitment.service';

// The block commitment, "no se puede cerrar" (weekend-mode, 2026-11-04).
@Module({
  imports: [RealtimeModule],
  controllers: [CommitmentController],
  providers: [CommitmentService],
  exports: [CommitmentService],
})
export class CommitmentModule {}
