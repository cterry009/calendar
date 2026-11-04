import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PlanningModule } from './planning/planning.module';
import { SyncModule } from './sync/sync.module';
import { StudyStatusModule } from './study-status/study-status.module';
import { TutorModule } from './tutor/tutor.module';
import { DailyReportModule } from './daily-report/daily-report.module';
import { CommitmentModule } from './commitment/commitment.module';
import { WeeklyReportModule } from './weekly-report/weekly-report.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    DevicesModule,
    RealtimeModule,
    SyncModule,
    PlanningModule,
    TutorModule,
    StudyStatusModule,
    DailyReportModule,
    CommitmentModule,
    WeeklyReportModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
