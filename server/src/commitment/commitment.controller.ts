import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { CommitmentService, commitmentView } from './commitment.service';

export class ExtendCommitmentDto {
  /** Days to add (7 by default). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  days?: number;

  @IsOptional()
  @IsBoolean()
  indefinite?: boolean;
}

@ApiTags('commitment')
@ApiBearerAuth('access-token')
@Controller('commitment')
@UseGuards(JwtAuthGuard)
export class CommitmentController {
  constructor(private readonly commitments: CommitmentService) {}

  @Get()
  @ApiOperation({ summary: 'El compromiso de bloqueo (null si nunca hubo)' })
  async get(@Req() req: AuthenticatedRequest) {
    return { commitment: commitmentView(await this.commitments.get(req.user.userId)) };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Empezar o alargar el compromiso (días más, o indefinido); nunca lo acorta' })
  async extend(@Req() req: AuthenticatedRequest, @Body() body: ExtendCommitmentDto) {
    return { commitment: await this.commitments.extend(req.user.userId, body) };
  }
}
