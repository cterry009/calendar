-- CreateEnum
CREATE TYPE "ScheduleCompletionStatus" AS ENUM ('DONE', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FocusEventKind" ADD VALUE 'BLOCK_EXITED';
ALTER TYPE "FocusEventKind" ADD VALUE 'BLOCK_RESUMED';
ALTER TYPE "FocusEventKind" ADD VALUE 'BLOCK_SKIPPED';

-- AlterTable
ALTER TABLE "pomodoro_sessions" ADD COLUMN     "exitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "scheduleId" TEXT;

-- AlterTable
ALTER TABLE "schedule_completions" ADD COLUMN     "reason" TEXT,
ADD COLUMN     "status" "ScheduleCompletionStatus" NOT NULL DEFAULT 'DONE';
