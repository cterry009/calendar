-- CreateEnum
CREATE TYPE "BlockListScope" AS ENUM ('FOCUS', 'NIGHT');

-- DropIndex
DROP INDEX "block_list_entries_userId_kind_identifier_key";

-- AlterTable
ALTER TABLE "block_list_entries" ADD COLUMN     "scope" "BlockListScope" NOT NULL DEFAULT 'FOCUS';

-- CreateIndex
CREATE UNIQUE INDEX "block_list_entries_userId_kind_identifier_scope_key" ON "block_list_entries"("userId", "kind", "identifier", "scope");
