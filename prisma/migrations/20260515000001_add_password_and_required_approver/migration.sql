-- AlterTable: store hashed (or demo plain-text) passwords for registered users
ALTER TABLE "users" ADD COLUMN "password" TEXT;

-- AlterTable: extracted from pipeline_result JSON for indexed DB-level filtering
ALTER TABLE "requests" ADD COLUMN "required_approver" TEXT;

-- Replace status-only index with composite index
DROP INDEX IF EXISTS "requests_status_idx";
CREATE INDEX "requests_status_required_approver_idx" ON "requests"("status", "required_approver");
