PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "albumId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Page_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Page" ("id", "albumId", "order", "templateId", "content", "createdAt")
SELECT
    "id",
    "albumId",
    ROW_NUMBER() OVER (PARTITION BY "albumId" ORDER BY "order", "createdAt", "id"),
    "templateId",
    "content",
    "createdAt"
FROM "Page";

DROP TABLE "Page";
ALTER TABLE "new_Page" RENAME TO "Page";

CREATE INDEX "Page_albumId_order_idx" ON "Page"("albumId", "order");
CREATE UNIQUE INDEX "Page_albumId_order_key" ON "Page"("albumId", "order");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
