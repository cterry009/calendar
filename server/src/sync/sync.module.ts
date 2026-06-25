import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [RealtimeModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
