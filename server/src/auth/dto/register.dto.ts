import { DevicePlatform } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  deviceLabel!: string;

  @IsEnum(DevicePlatform)
  devicePlatform!: DevicePlatform;
}
