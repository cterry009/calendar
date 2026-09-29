-- CreateTable
CREATE TABLE "schedule_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_completions_userId_date_idx" ON "schedule_completions"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_completions_scheduleId_date_key" ON "schedule_completions"("scheduleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_completions_userId_clientId_key" ON "schedule_completions"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "schedule_completions" ADD CONSTRAINT "schedule_completions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_completions" ADD CONSTRAINT "schedule_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
