import { Module } from '@nestjs/common';
import { DAILY_REPORT_CONFIG, dailyReportConfig } from '../daily-report/daily-report.service';
import { gmailMailer, MAILER } from '../daily-report/mailer';
import { WeeklyReportController } from './weekly-report.controller';
import { WEEKLY_REPORT_CONFIG, WeeklyReportService, weeklyReportConfig } from './weekly-report.service';

// The Sunday report and its presentation (weekend-mode, 2026-11-04). Same account, mail credentials
// and time zone as the daily email.
@Module({
  controllers: [WeeklyReportController],
  providers: [
    { provide: DAILY_REPORT_CONFIG, useFactory: () => dailyReportConfig() },
    { provide: MAILER, useFactory: () => gmailMailer() },
    { provide: WEEKLY_REPORT_CONFIG, useFactory: () => weeklyReportConfig() },
    WeeklyReportService,
  ],
})
export class WeeklyReportModule {}
