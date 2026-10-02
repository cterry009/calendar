import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class LabelTasksDto {
  @ApiPropertyOptional({
    description: 'Volver a calificar también las tareas que ya tienen perfil (nunca las que calificó el usuario)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
