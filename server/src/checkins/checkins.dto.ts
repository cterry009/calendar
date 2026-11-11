import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCheckInDto {
  /** Client id: a retried POST doesn't duplicate the row. */
  @IsString()
  @MaxLength(100)
  clientId!: string;

  @IsDateString()
  at!: string;

  @IsIn(['fijo', 'dinamico', 'manual'])
  kind!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  energy?: number;

  @IsOptional()
  @IsBoolean()
  napped?: boolean;

  @IsOptional()
  @IsIn(['suave', 'medio', 'muy-intenso'])
  exerciseIntensity?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
