-- Multi-region pricing: GBP required (base + settlement), USD optional.
-- Preserve existing data by copying the old single `price` into `priceGBP`.

ALTER TABLE "products" ADD COLUMN "priceGBP" DECIMAL(10,2);
ALTER TABLE "products" ADD COLUMN "priceUSD" DECIMAL(10,2);

UPDATE "products" SET "priceGBP" = "price";

ALTER TABLE "products" ALTER COLUMN "priceGBP" SET NOT NULL;

ALTER TABLE "products" DROP COLUMN "price";
ALTER TABLE "products" DROP COLUMN "currency";
