import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class StructureTaskDto {
  @ApiProperty({ description: 'La tarea como la escribiría el usuario', example: 'repasar el teorema de Darboux para el parcial' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  text!: string;

  @ApiPropertyOptional({ description: 'Guardarla (una tarea sin fecha por sesión) en vez de solo proponerla', default: false })
  @IsOptional()
  @IsBoolean()
  create?: boolean;
}
