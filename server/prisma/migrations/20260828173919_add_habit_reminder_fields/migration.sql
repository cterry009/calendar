-- AlterTable
ALTER TABLE "habits" ADD COLUMN     "reminderDaysOfWeek" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
ADD COLUMN     "reminderEndMinute" INTEGER,
ADD COLUMN     "reminderStartMinute" INTEGER;
