-- CreateEnum
CREATE TYPE "BlockEventTrigger" AS ENUM ('BLOCKED_OPEN_ATTEMPT', 'NIGHT_UNLOCK');

-- CreateTable
CREATE TABLE "block_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identifier" TEXT,
    "scope" "BlockListScope" NOT NULL,
    "trigger" "BlockEventTrigger" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "block_events_userId_occurredAt_idx" ON "block_events"("userId", "occurredAt");

-- AddForeignKey
ALTER TABLE "block_events" ADD CONSTRAINT "block_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
