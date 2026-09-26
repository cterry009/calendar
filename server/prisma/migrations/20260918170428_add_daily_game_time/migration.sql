-- CreateTable
CREATE TABLE "daily_game_time" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalMinutes" INTEGER NOT NULL,
    "topGames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_game_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_game_time_userId_date_key" ON "daily_game_time"("userId", "date");

-- AddForeignKey
ALTER TABLE "daily_game_time" ADD CONSTRAINT "daily_game_time_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
