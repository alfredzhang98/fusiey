-- Product: certified-pattern JSON + non-certified download file fields
ALTER TABLE "products" ADD COLUMN     "isCertifiedPattern" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patternData" JSONB,
ADD COLUMN     "patternFileType" TEXT,
ADD COLUMN     "patternFileUrl" TEXT;

-- SavedPattern: purchased/official copy tracking
ALTER TABLE "saved_patterns" ADD COLUMN     "isPurchased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceProductId" TEXT;

-- CreateTable
CREATE TABLE "media_folders" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pattern_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_folders_category_code_key" ON "media_folders"("category", "code");

-- CreateIndex
CREATE INDEX "media_assets_folderId_idx" ON "media_assets"("folderId");

-- CreateIndex
CREATE INDEX "pattern_purchases_userId_createdAt_idx" ON "pattern_purchases"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pattern_purchases_userId_productId_key" ON "pattern_purchases"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_patterns_userId_sourceProductId_key" ON "saved_patterns"("userId", "sourceProductId");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pattern_purchases" ADD CONSTRAINT "pattern_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
