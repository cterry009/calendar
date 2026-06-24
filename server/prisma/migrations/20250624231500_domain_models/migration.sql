-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('WEB', 'ANDROID', 'IOS', 'WINDOWS', 'MACOS');

-- CreateEnum
CREATE TYPE "TaskDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('WORK', 'REST');

-- CreateEnum
CREATE TYPE "PomodoroState" AS ENUM ('IDLE', 'FOCUS', 'SHORT_BREAK', 'LONG_BREAK');

-- CreateEnum
CREATE TYPE "BlockListKind" AS ENUM ('MOBILE_APP', 'WEBSITE', 'DESKTOP_APP');

-- CreateEnum
CREATE TYPE "FitnessIntensity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FitnessSource" AS ENUM ('MANUAL', 'HEALTH_CONNECT', 'HEALTHKIT', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "AnalyticsPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "googleId" TEXT,
    "appleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "refreshToken" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "estimatedMinutes" INTEGER NOT NULL,
    "actualMinutes" INTEGER,
    "difficulty" "TaskDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "complexity" INTEGER NOT NULL DEFAULT 5,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "clientId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "ScheduleKind" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pomodoro_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "state" "PomodoroState" NOT NULL DEFAULT 'IDLE',
    "focusDurationMin" INTEGER NOT NULL DEFAULT 25,
    "shortBreakMin" INTEGER NOT NULL DEFAULT 5,
    "longBreakMin" INTEGER NOT NULL DEFAULT 15,
    "cyclesBeforeLongBreak" INTEGER NOT NULL DEFAULT 4,
    "completedCycles" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "interrupted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pomodoro_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_list_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BlockListKind" NOT NULL,
    "identifier" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" "DevicePlatform",
    "highDopamine" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fitness_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "intensity" "FitnessIntensity" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "source" "FitnessSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fitness_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" "AnalyticsPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "pomodorosCompleted" INTEGER NOT NULL DEFAULT 0,
    "pomodorosInterrupted" INTEGER NOT NULL DEFAULT 0,
    "focusMinutes" INTEGER NOT NULL DEFAULT 0,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "estimationErrorPct" DOUBLE PRECISION,
    "serotoninScore" INTEGER,
    "fitnessMinutes" INTEGER NOT NULL DEFAULT 0,
    "suggestions" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_refreshToken_key" ON "devices"("refreshToken");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE INDEX "tasks_userId_scheduledAt_idx" ON "tasks"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_userId_clientId_key" ON "tasks"("userId", "clientId");

-- CreateIndex
CREATE INDEX "schedules_userId_kind_idx" ON "schedules"("userId", "kind");

-- CreateIndex
CREATE INDEX "pomodoro_sessions_userId_active_idx" ON "pomodoro_sessions"("userId", "active");

-- CreateIndex
CREATE INDEX "block_list_entries_userId_idx" ON "block_list_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "block_list_entries_userId_kind_identifier_key" ON "block_list_entries"("userId", "kind", "identifier");

-- CreateIndex
CREATE INDEX "fitness_entries_userId_loggedAt_idx" ON "fitness_entries"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "analytics_snapshots_userId_periodStart_idx" ON "analytics_snapshots"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_snapshots_userId_period_periodStart_key" ON "analytics_snapshots"("userId", "period", "periodStart");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block_list_entries" ADD CONSTRAINT "block_list_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fitness_entries" ADD CONSTRAINT "fitness_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
