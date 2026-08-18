-- CreateEnum
CREATE TYPE "HabitType" AS ENUM ('NORMAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "HabitRecordStatus" AS ENUM ('DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "habits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "HabitType" NOT NULL DEFAULT 'NORMAL',
    "dailyGoalValue" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dailyGoalUnit" TEXT NOT NULL DEFAULT 'times',
    "dailyGoalExtraValue" DOUBLE PRECISION,
    "targetDays" INTEGER NOT NULL DEFAULT 66,
    "color" TEXT,
    "category" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_records" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "HabitRecordStatus" NOT NULL DEFAULT 'DONE',
    "autoCompleted" BOOLEAN NOT NULL DEFAULT false,
    "fitnessEntryId" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recordId" TEXT,
    "content" TEXT NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "habits_userId_clientId_key" ON "habits"("userId", "clientId");

-- CreateIndex
CREATE INDEX "habits_userId_archived_idx" ON "habits"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "habit_records_habitId_date_key" ON "habit_records"("habitId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "habit_records_userId_clientId_key" ON "habit_records"("userId", "clientId");

-- CreateIndex
CREATE INDEX "habit_records_userId_date_idx" ON "habit_records"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_userId_clientId_key" ON "journal_entries"("userId", "clientId");

-- CreateIndex
CREATE INDEX "journal_entries_habitId_createdAt_idx" ON "journal_entries"("habitId", "createdAt");

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_records" ADD CONSTRAINT "habit_records_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_records" ADD CONSTRAINT "habit_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_records" ADD CONSTRAINT "habit_records_fitnessEntryId_fkey" FOREIGN KEY ("fitnessEntryId") REFERENCES "fitness_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "habit_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
