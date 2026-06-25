import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
