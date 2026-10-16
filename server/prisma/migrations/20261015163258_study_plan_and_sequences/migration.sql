-- AlterEnum
ALTER TYPE "FocusEventKind" ADD VALUE 'SEGMENT_CUT';

-- AlterTable
ALTER TABLE "pomodoro_sessions" ADD COLUMN     "blockStartAt" TIMESTAMP(3),
ADD COLUMN     "cutCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "segmentIndex" INTEGER,
ADD COLUMN     "sequence" JSONB;

-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "category" TEXT,
ADD COLUMN     "sequence" JSONB;

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "label" TEXT,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_exceptions_userId_date_idx" ON "schedule_exceptions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exceptions_scheduleId_date_key" ON "schedule_exceptions"("scheduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exceptions_userId_clientId_key" ON "schedule_exceptions"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "study_plans_userId_key" ON "study_plans"("userId");

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
