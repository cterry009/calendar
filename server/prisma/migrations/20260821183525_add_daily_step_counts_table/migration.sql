-- CreateTable
CREATE TABLE "daily_step_counts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "steps" INTEGER NOT NULL,
    "source" "FitnessSource" NOT NULL DEFAULT 'DEVICE_SENSOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_step_counts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_step_counts_userId_date_key" ON "daily_step_counts"("userId", "date");

-- AddForeignKey
ALTER TABLE "daily_step_counts" ADD CONSTRAINT "daily_step_counts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
