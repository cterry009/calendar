import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { PrismaService } from '../prisma/prisma.service';
import { DailyReportService } from './daily-report.service';

@ApiTags('daily-report')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class DailyReportController {
  constructor(
    private readonly reports: DailyReportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('planning/suggestions/pending')
  @ApiOperation({ summary: 'El plan sugerido por el reporte diario que espera aprobación (null si no hay)' })
  async pending(@Req() req: AuthenticatedRequest) {
    return { suggestion: await this.reports.pending(req.user.userId) };
  }

  @Post('planning/suggestions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar el plan sugerido: agenda sus tareas en los bloques propuestos' })
  approve(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reports.approve(req.user.userId, id);
  }

  @Post('planning/suggestions/:id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Descartar el plan sugerido' })
  async dismiss(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.reports.dismiss(req.user.userId, id);
  }

  @Post('daily-report/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar ya el reporte de un día (hoy por defecto); con dryRun lo devuelve sin enviar' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'dryRun', required: false })
  async send(@Req() req: AuthenticatedRequest, @Query('date') date?: string, @Query('dryRun') dryRun?: string) {
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : this.reports.today();
    if (dryRun === 'true' || dryRun === '1') return this.reports.preview(req.user.userId, day);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user.userId }, select: { email: true } });
    return this.reports.send(req.user.userId, user.email, day, { record: false });
  }
}
