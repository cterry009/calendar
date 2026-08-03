-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "longBreakMin" INTEGER,
ADD COLUMN     "pomodoroMin" INTEGER,
ADD COLUMN     "pomodorosPerChunk" INTEGER,
ADD COLUMN     "shortBreakMin" INTEGER;
