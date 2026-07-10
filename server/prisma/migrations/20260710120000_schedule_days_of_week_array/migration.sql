-- AlterTable: replace single dayOfWeek with a daysOfWeek array so one schedule
-- record can span multiple weekdays instead of one row being created per day.
ALTER TABLE "schedules" ADD COLUMN "daysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

UPDATE "schedules" SET "daysOfWeek" = ARRAY["dayOfWeek"];

ALTER TABLE "schedules" ALTER COLUMN "daysOfWeek" DROP DEFAULT;

ALTER TABLE "schedules" DROP COLUMN "dayOfWeek";
