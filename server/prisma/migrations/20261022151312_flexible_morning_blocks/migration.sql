-- AlterTable
ALTER TABLE "pomodoro_sessions" ADD COLUMN     "flexible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "focusMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plannedBlockMin" INTEGER,
ADD COLUMN     "windowEndAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "flexibleBlocks" INTEGER;
