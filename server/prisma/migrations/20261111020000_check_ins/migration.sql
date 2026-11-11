-- Check-ins (2026-11-10).
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "energy" INTEGER,
    "napped" BOOLEAN,
    "exerciseIntensity" TEXT,
    "progress" INTEGER,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "check_ins_userId_clientId_key" ON "check_ins"("userId", "clientId");
CREATE INDEX "check_ins_userId_at_idx" ON "check_ins"("userId", "at");
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
