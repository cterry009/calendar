import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module';
import { LayaClient } from './complexity';
import { GeminiPlanner, geminiGenerate, type Generate } from './gemini-planner';
import { HeuristicPlanner } from './heuristic-planner';
import { PLANNER, type Planner } from './planner';
import { planningConfig } from './planning.config';
import { PlanningController } from './planning.controller';
import { GEMINI, LAYA, PlanningService } from './planning.service';

@Module({
  imports: [RealtimeModule],
  controllers: [PlanningController],
  providers: [
    PlanningService,
    HeuristicPlanner,
    // Gemini when there's a key; the heuristic otherwise (and as the service's fallback either way).
    {
      provide: PLANNER,
      inject: [HeuristicPlanner],
      useFactory: (heuristic: HeuristicPlanner): Planner => {
        const config = planningConfig();
        return config.geminiApiKey ? new GeminiPlanner(config) : heuristic;
      },
    },
    {
      provide: GEMINI,
      useFactory: (): Generate | null => {
        const { geminiApiKey } = planningConfig();
        return geminiApiKey ? geminiGenerate(geminiApiKey) : null;
      },
    },
    {
      provide: LAYA,
      useFactory: (): LayaClient | null => {
        const { layaUrl } = planningConfig();
        return layaUrl ? new LayaClient(layaUrl) : null;
      },
    },
  ],
})
export class PlanningModule {}
