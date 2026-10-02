-- CreateEnum
CREATE TYPE "AttentionProfile" AS ENUM ('P0', 'P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "AttentionSource" AS ENUM ('REFERENCE', 'MODEL', 'USER');

-- CreateEnum
CREATE TYPE "FocusEventKind" AS ENUM ('BLOCK_PROMPT_ACCEPTED', 'BLOCK_PROMPT_SNOOZED', 'BLOCK_PROMPT_DECLINED', 'BLOCK_PROMPT_OPENED', 'FOCUS_STARTED', 'FOCUS_COMPLETED', 'BREAK_COMPLETED', 'SESSION_CANCELLED', 'BLOCK_ENDED', 'CHECK_IN');

-- AlterTable
ALTER TABLE "pomodoro_sessions" ADD COLUMN     "attentionProfile" "AttentionProfile",
ADD COLUMN     "blockEndAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "attentionLoad" INTEGER,
ADD COLUMN     "attentionProfile" "AttentionProfile",
ADD COLUMN     "attentionReason" TEXT,
ADD COLUMN     "attentionReentry" INTEGER,
ADD COLUMN     "attentionSource" "AttentionSource";

-- CreateTable
CREATE TABLE "focus_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FocusEventKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "scheduleId" TEXT,
    "taskId" TEXT,
    "pomodoroSessionId" TEXT,
    "attentionProfile" "AttentionProfile",
    "blockStartAt" TIMESTAMP(3),
    "value" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "focus_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "focus_events_userId_occurredAt_idx" ON "focus_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "focus_events_userId_kind_idx" ON "focus_events"("userId", "kind");

-- AddForeignKey
ALTER TABLE "focus_events" ADD CONSTRAINT "focus_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
