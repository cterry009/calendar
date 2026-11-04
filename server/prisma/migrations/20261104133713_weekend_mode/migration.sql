-- CreateEnum
CREATE TYPE "HabitKind" AS ENUM ('HABIT', 'WEEKEND_ACTIVITY');

-- AlterTable
ALTER TABLE "block_list_entries" ADD COLUMN     "nightStartMinutes" INTEGER,
ADD COLUMN     "weekendNightStartMinutes" INTEGER;

-- AlterTable
ALTER TABLE "habits" ADD COLUMN     "kind" "HabitKind" NOT NULL DEFAULT 'HABIT';

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_commitments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_commitments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_userId_weekStart_key" ON "weekly_reports"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "block_commitments_userId_key" ON "block_commitments"("userId");

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_commitments" ADD CONSTRAINT "block_commitments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
