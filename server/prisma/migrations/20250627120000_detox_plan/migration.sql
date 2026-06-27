-- CreateTable
CREATE TABLE "detox_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planData" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detox_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "detox_plans_userId_key" ON "detox_plans"("userId");

-- AddForeignKey
ALTER TABLE "detox_plans" ADD CONSTRAINT "detox_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
