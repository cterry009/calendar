import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { TutorCatalog } from './catalog';
import { TutorController } from './tutor.controller';
import { TutorGameService } from './tutor-game.service';
import { ClaudeCliTutor, TUTOR_MODEL } from './tutor-model';
import { tutorConfig } from './tutor.config';
import { TutorService } from './tutor.service';

// The study tutor (openspec study-tutor-game, phase 3).
@Module({
  imports: [SyncModule],
  controllers: [TutorController],
  providers: [
    { provide: TutorCatalog, useFactory: () => new TutorCatalog(tutorConfig().vault) },
    TutorGameService,
    TutorService,
    { provide: TUTOR_MODEL, useFactory: () => new ClaudeCliTutor(tutorConfig()) },
  ],
})
export class TutorModule {}
