-- CreateTable
CREATE TABLE "daily_floors_climbed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "floors" INTEGER NOT NULL,
    "source" "FitnessSource" NOT NULL DEFAULT 'DEVICE_SENSOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_floors_climbed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_floors_climbed_userId_date_key" ON "daily_floors_climbed"("userId", "date");

-- AddForeignKey
ALTER TABLE "daily_floors_climbed" ADD CONSTRAINT "daily_floors_climbed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
