-- CreateTable
CREATE TABLE "Province" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "visited" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provinceCode" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "annotation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "Province" ("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
