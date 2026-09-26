-- CreateTable
CREATE TABLE "daily_desktop_app_time" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "topApps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_desktop_app_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_desktop_app_time_userId_date_key" ON "daily_desktop_app_time"("userId", "date");

-- AddForeignKey
ALTER TABLE "daily_desktop_app_time" ADD CONSTRAINT "daily_desktop_app_time_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
