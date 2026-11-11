import { Module } from '@nestjs/common';
import { CheckInsController } from './checkins.controller';

@Module({ controllers: [CheckInsController] })
export class CheckInsModule {}
