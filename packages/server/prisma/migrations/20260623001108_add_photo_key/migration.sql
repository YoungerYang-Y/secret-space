-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provinceCode" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "annotation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "Province" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Photo" ("annotation", "createdAt", "id", "order", "provinceCode", "url") SELECT "annotation", "createdAt", "id", "order", "provinceCode", "url" FROM "Photo";
DROP TABLE "Photo";
ALTER TABLE "new_Photo" RENAME TO "Photo";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
