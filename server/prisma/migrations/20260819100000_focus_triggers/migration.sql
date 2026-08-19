-- CreateEnum
CREATE TYPE "FocusTriggerKind" AS ENUM ('LOCATION', 'WIFI');

-- CreateTable
CREATE TABLE "focus_triggers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FocusTriggerKind" NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusMeters" INTEGER,
    "wifiSsid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "focus_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "focus_triggers_userId_idx" ON "focus_triggers"("userId");

-- AddForeignKey
ALTER TABLE "focus_triggers" ADD CONSTRAINT "focus_triggers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
