import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../common/auth-request.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { OAuthAppleDto, OAuthGoogleDto } from './dto/oauth.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OAuthService } from './oauth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly oauthService: OAuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() dto: OAuthGoogleDto) {
    return this.oauthService.loginWithGoogle(dto);
  }

  @Post('oauth/apple')
  @HttpCode(HttpStatus.OK)
  loginWithApple(@Body() dto: OAuthAppleDto) {
    return this.oauthService.loginWithApple(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: AuthenticatedRequest) {
    await this.authService.logout(req.user.userId, req.user.deviceId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.userId);
  }
}
