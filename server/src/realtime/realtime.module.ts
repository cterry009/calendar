import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { SyncEventsService } from './sync-events.service';
import { SyncGateway } from './sync.gateway';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [SyncGateway, SyncEventsService],
  exports: [SyncEventsService, SyncGateway],
})
export class RealtimeModule {}
