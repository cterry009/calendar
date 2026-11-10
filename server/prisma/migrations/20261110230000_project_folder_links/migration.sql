-- Project folder and links (2026-11-10).
ALTER TABLE "projects" ADD COLUMN "localPath" TEXT;
ALTER TABLE "projects" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]';
