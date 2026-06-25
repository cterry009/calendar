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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.devicesService.list(req.user.userId);
  }

  @Post('register')
  register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.register(req.user.userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
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
