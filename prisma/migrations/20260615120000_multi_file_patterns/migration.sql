-- Non-certified pattern deliverables can now be multiple files (PNG pages),
-- while PDFs stay a single file. Add array columns and backfill from the
-- existing single-file columns so old rows keep working.

ALTER TABLE "products" ADD COLUMN "patternFileUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "pattern_purchases" ADD COLUMN "fileUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: seed the arrays with the existing single file (if any).
UPDATE "products"
  SET "patternFileUrls" = ARRAY["patternFileUrl"]
  WHERE "patternFileUrl" IS NOT NULL AND "patternFileUrl" <> '';

UPDATE "pattern_purchases"
  SET "fileUrls" = ARRAY["fileUrl"]
  WHERE "fileUrl" IS NOT NULL AND "fileUrl" <> '';
