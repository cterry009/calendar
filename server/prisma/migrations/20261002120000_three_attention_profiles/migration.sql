-- Five attention profiles become three (2026-10-01): P0 -> MECHANICAL, P1/P2 -> LIGHT, P3/P4 -> DEEP.
-- Existing ratings are converted, not dropped.
ALTER TYPE "AttentionProfile" RENAME TO "AttentionProfile_old";
CREATE TYPE "AttentionProfile" AS ENUM ('MECHANICAL', 'LIGHT', 'DEEP');

ALTER TABLE "tasks" ALTER COLUMN "attentionProfile" TYPE "AttentionProfile" USING (
  CASE "attentionProfile"::text WHEN 'P0' THEN 'MECHANICAL' WHEN 'P1' THEN 'LIGHT' WHEN 'P2' THEN 'LIGHT' WHEN 'P3' THEN 'DEEP' WHEN 'P4' THEN 'DEEP' END
)::"AttentionProfile";
ALTER TABLE "pomodoro_sessions" ALTER COLUMN "attentionProfile" TYPE "AttentionProfile" USING (
  CASE "attentionProfile"::text WHEN 'P0' THEN 'MECHANICAL' WHEN 'P1' THEN 'LIGHT' WHEN 'P2' THEN 'LIGHT' WHEN 'P3' THEN 'DEEP' WHEN 'P4' THEN 'DEEP' END
)::"AttentionProfile";
ALTER TABLE "focus_events" ALTER COLUMN "attentionProfile" TYPE "AttentionProfile" USING (
  CASE "attentionProfile"::text WHEN 'P0' THEN 'MECHANICAL' WHEN 'P1' THEN 'LIGHT' WHEN 'P2' THEN 'LIGHT' WHEN 'P3' THEN 'DEEP' WHEN 'P4' THEN 'DEEP' END
)::"AttentionProfile";

DROP TYPE "AttentionProfile_old";
