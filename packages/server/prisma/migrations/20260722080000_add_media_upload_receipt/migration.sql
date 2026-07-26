-- CreateTable
CREATE TABLE "MediaUploadReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "provinceCode" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUploadReceipt_key_key" ON "MediaUploadReceipt"("key");

-- CreateIndex
CREATE INDEX "MediaUploadReceipt_expiresAt_idx" ON "MediaUploadReceipt"("expiresAt");
