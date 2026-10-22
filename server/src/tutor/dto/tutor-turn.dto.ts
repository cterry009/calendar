import { Type } from 'class-transformer';
import {
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
}
