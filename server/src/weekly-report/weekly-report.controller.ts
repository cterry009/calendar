import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { PrismaService } from '../prisma/prisma.service';
import { mondayOf, WeeklyReportService } from './weekly-report.service';

function weekParam(value: string | undefined, fallback: string): string {
  if (!value) return mondayOf(fallback);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('La semana va como YYYY-MM-DD.');
  return mondayOf(value);
}

@ApiTags('weekly-report')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class WeeklyReportController {
  constructor(
    private readonly reports: WeeklyReportService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('weekly-reports')
  @ApiOperation({ summary: 'Las semanas con reporte, la más reciente primero' })
  async list(@Req() req: AuthenticatedRequest) {
    return { weeks: await this.reports.list(req.user.userId) };
  }

  @Get('weekly-reports/:week')
  @ApiOperation({ summary: 'Los datos de una semana (cualquier día de ella)' })
  get(@Req() req: AuthenticatedRequest, @Param('week') week: string) {
    return this.reports.get(req.user.userId, weekParam(week, this.reports.today()));
  }

  @Get('weekly-reports/:week/presentation')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'La presentación de una semana (HTML autocontenido)' })
  async presentation(@Req() req: AuthenticatedRequest, @Param('week') week: string) {
    return this.reports.presentation(await this.reports.get(req.user.userId, weekParam(week, this.reports.today())));
  }

  @Get('weekly-reports/:week/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Una fila por día de la semana' })
  async csv(@Req() req: AuthenticatedRequest, @Param('week') week: string) {
    return this.reports.csv(await this.reports.get(req.user.userId, weekParam(week, this.reports.today())));
  }

  @Post('weekly-report/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar ya el reporte de una semana (la actual por defecto), sin contar como el del domingo' })
  @ApiQuery({ name: 'week', required: false, description: 'Cualquier día de la semana, YYYY-MM-DD' })
  async send(@Req() req: AuthenticatedRequest, @Query('week') week?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: req.user.userId }, select: { email: true } });
    return this.reports.send(req.user.userId, user.email, weekParam(week, this.reports.today()), { record: false });
  }
}
