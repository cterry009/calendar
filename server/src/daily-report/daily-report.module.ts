import { Module } from '@nestjs/common';
import { PlanningModule } from '../planning/planning.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DailyReportController } from './daily-report.controller';
import { DAILY_REPORT_CONFIG, DailyReportService, dailyReportConfig } from './daily-report.service';
import { gmailMailer, MAILER } from './mailer';

// The daily email and the plan it suggests (daily-email-report, 2026-10-29).
@Module({
  imports: [PlanningModule, RealtimeModule],
  controllers: [DailyReportController],
  providers: [
    { provide: DAILY_REPORT_CONFIG, useFactory: () => dailyReportConfig() },
    { provide: MAILER, useFactory: () => gmailMailer() },
    DailyReportService,
  ],
})
export class DailyReportModule {}
