import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { ProposePlanDto } from './dto/propose-plan.dto';
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
}
