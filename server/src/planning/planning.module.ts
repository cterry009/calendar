import { Module } from '@nestjs/common';
import { HeuristicPlanner } from './heuristic-planner';
import { PLANNER } from './planner';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';

@Module({
  controllers: [PlanningController],
  // Swap for an LLM planner once one is chosen; the validator stays in front of it either way.
  providers: [PlanningService, { provide: PLANNER, useClass: HeuristicPlanner }],
})
export class PlanningModule {}
