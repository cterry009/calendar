import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { ProjectChatDto } from './project-chat.dto';
import { ProjectChatService } from './project-chat.service';

@ApiTags('projects')
@ApiBearerAuth('access-token')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectChatController {
  constructor(private readonly chat: ProjectChatService) {}

  @Post(':id/chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Un mensaje al chat de IA del proyecto (Claude con el puente del calendario)' })
  turn(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ProjectChatDto) {
    return this.chat.turn(req.user.userId, id, dto.message, dto.sessionId);
  }
}
