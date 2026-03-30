-- Change approver_id from UUID to TEXT so file-based session IDs (u-xxxxxxxx) are accepted
ALTER TABLE "decisions" ALTER COLUMN "approver_id" TYPE TEXT;
