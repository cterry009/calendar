import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { LabelTasksDto } from './dto/label-tasks.dto';
import { ProposePlanDto } from './dto/propose-plan.dto';
import { StructureTaskDto } from './dto/structure-task.dto';
import { PlanningService } from './planning.service';

@ApiTags('planning')
@ApiBearerAuth('access-token')
@Controller('planning')
@UseGuards(JwtAuthGuard)
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Post('propose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Proponer dónde van las tareas pendientes sin fecha (no escribe nada; el usuario acepta en la app)',
  })
  propose(@Req() req: AuthenticatedRequest, @Body() dto: ProposePlanDto) {
    return this.planningService.propose(req.user.userId, dto);
  }

  @Post('label')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calificar la atención de las tareas pendientes (R, C y perfil): etiquetas de referencia primero, Gemini para el resto',
  })
  label(@Req() req: AuthenticatedRequest, @Body() dto: LabelTasksDto) {
    return this.planningService.labelTasks(req.user.userId, dto);
  }

  @Post('structure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Convertir una tarea suelta en una tarea estructurada con Gemini (y el perfil de Laya para comparar); con create la guarda',
  })
  structure(@Req() req: AuthenticatedRequest, @Body() dto: StructureTaskDto) {
    return this.planningService.structureTask(req.user.userId, dto);
  }
}
