-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isDigital" BOOLEAN NOT NULL DEFAULT false;
