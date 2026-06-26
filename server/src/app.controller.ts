import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Comprobar que la API está viva' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', service: 'calendar-api' },
    },
  })
  health() {
    return { status: 'ok', service: 'calendar-api' };
  }

  @Get('health/db')
  @ApiOperation({ summary: 'Comprobar conexión a PostgreSQL' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', database: 'connected' },
    },
  })
  async healthDb() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  }
}
