-- Project objectives and tags (2026-11-09).
ALTER TABLE "projects" ADD COLUMN "generalObjective" TEXT;
ALTER TABLE "projects" ADD COLUMN "specificObjectives" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "projects" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
