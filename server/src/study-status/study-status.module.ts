import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { SyncModule } from '../sync/sync.module';
import { STUDY_STATUS_CONFIG, StudyStatusService, studyStatusConfig } from './study-status.service';

// The vault's study status, rewritten by the server after study changes (dynamic-study-blocks D18).
@Module({
  imports: [SyncModule, RealtimeModule],
  providers: [
    { provide: STUDY_STATUS_CONFIG, useFactory: () => studyStatusConfig() },
    StudyStatusService,
  ],
})
export class StudyStatusModule {}
