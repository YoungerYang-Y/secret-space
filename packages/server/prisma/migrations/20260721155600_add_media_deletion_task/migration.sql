-- CreateTable
CREATE TABLE "MediaDeletionTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "doneAt" DATETIME
);

-- CreateIndex
CREATE INDEX "MediaDeletionTask_status_nextAttemptAt_idx" ON "MediaDeletionTask"("status", "nextAttemptAt");
