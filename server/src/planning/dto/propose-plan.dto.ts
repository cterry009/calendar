import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class ProposePlanDto {
  @ApiPropertyOptional({ description: 'Zona horaria IANA del usuario', example: 'America/Bogota' })
  @IsOptional()
  @IsString()
  timeZone?: string;

  @ApiPropertyOptional({ description: 'Primer día del plan (YYYY-MM-DD); por defecto hoy en `timeZone`' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ description: 'Días que cubre el plan', default: 7, minimum: 1, maximum: 28 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  days?: number;

  @ApiPropertyOptional({ description: 'Solo planificar estas tareas (por defecto todas las pendientes sin fecha)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  taskIds?: string[];
}
