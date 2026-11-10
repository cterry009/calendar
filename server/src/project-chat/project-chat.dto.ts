import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ProjectChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  /** The conversation to continue; absent on the first message. */
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
