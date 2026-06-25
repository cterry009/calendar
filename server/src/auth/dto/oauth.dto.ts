import { DevicePlatform } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class OAuthGoogleDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  devicePlatform?: DevicePlatform;
}

export class OAuthAppleDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  devicePlatform?: DevicePlatform;
}
