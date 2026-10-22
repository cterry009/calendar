import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { TutorSectionQueryDto, TutorTurnDto } from './dto/tutor-turn.dto';
import { TutorService } from './tutor.service';

@ApiTags('tutor')
@ApiBearerAuth('access-token')
@Controller('tutor')
@UseGuards(JwtAuthGuard)
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Post('turn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Un turno del tutor: Claude explica, propone o califica; la app elige el ejercicio y registra el intento',
  })
  turn(@Req() req: AuthenticatedRequest, @Body() dto: TutorTurnDto) {
    return this.tutor.turn(req.user.userId, req.user.deviceId, dto);
  }

  @Get('notes')
  @ApiOperation({ summary: 'Notas del vault con ejercicios y sus secciones' })
  notes() {
    return this.tutor.notes();
  }

  @Get('state')
  @ApiOperation({
    summary: 'Estado del juego de una sección y el siguiente ejercicio (sin Claude)',
  })
  state(@Req() req: AuthenticatedRequest, @Query() query: TutorSectionQueryDto) {
    return this.tutor.state(req.user.userId, query);
  }
}
