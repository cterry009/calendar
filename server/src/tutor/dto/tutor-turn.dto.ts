import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TutorSectionQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  noteCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  section!: string;
}

/** The exercise on the table, as an earlier turn returned it. */
export class TutorCurrentExerciseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  exerciseId!: string;

  @IsIn(['nota', 'generado'])
  source!: 'nota' | 'generado';

  /** Generated exercises only: the b the engine gave it. */
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-6)
  @Max(6)
  b?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  statement?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  answer?: string;
}

/** One earlier message of the chat, for when Claude's session can't be resumed. */
export class TutorHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  text!: string;
}

export class TutorTurnDto extends TutorSectionQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  message!: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TutorCurrentExerciseDto)
  current?: TutorCurrentExerciseDto;

  @IsOptional()
  @IsString()
  pomodoroSessionId?: string;

  @IsOptional()
  @IsString()
  studyTaskId?: string;

  /** The chat's last messages (2026-11-11): the tutor's memory when the session was lost. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @ValidateNested({ each: true })
  @Type(() => TutorHistoryMessageDto)
  history?: TutorHistoryMessageDto[];
}
