import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@ApiTags('devices')
@ApiBearerAuth('access-token')
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar dispositivos registrados' })
  list(@Req() req: AuthenticatedRequest) {
    return this.devicesService.list(req.user.userId);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Registrar un nuevo dispositivo y emitir tokens de sesión',
  })
  register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar un dispositivo (no el actual)' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo a revocar' })
  @ApiNoContentResponse()
  async revoke(
    @Req() req: AuthenticatedRequest,
    @Param('id') deviceId: string,
  ) {
    await this.devicesService.revoke(
      req.user.userId,
      deviceId,
      req.user.deviceId,
    );
  }
}
