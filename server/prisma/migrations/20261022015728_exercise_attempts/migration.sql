-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('nota', 'generado');

-- CreateEnum
CREATE TYPE "ExerciseGrader" AS ENUM ('claude', 'usuario');

-- CreateTable
CREATE TABLE "exercise_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exerciseSource" "ExerciseSource" NOT NULL,
    "noteCode" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "b" DOUBLE PRECISION NOT NULL,
    "r" DOUBLE PRECISION NOT NULL,
    "hints" INTEGER NOT NULL DEFAULT 0,
    "minutes" INTEGER,
    "gradedBy" "ExerciseGrader" NOT NULL,
    "supersedes" TEXT,
    "generatedStatement" TEXT,
    "feedback" TEXT,
    "studyTaskId" TEXT,
    "pomodoroSessionId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercise_attempts_userId_occurredAt_idx" ON "exercise_attempts"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "exercise_attempts_userId_noteCode_idx" ON "exercise_attempts"("userId", "noteCode");

-- AddForeignKey
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
