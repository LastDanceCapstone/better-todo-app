-- Add per-user notification settings (authoritative backend source of truth)
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "morningOverview" BOOLEAN NOT NULL DEFAULT true,
    "eveningReview" BOOLEAN NOT NULL DEFAULT true,
    "dueSoonNotifications" BOOLEAN NOT NULL DEFAULT true,
    "overdueNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

ALTER TABLE "notification_settings"
ADD CONSTRAINT "notification_settings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Add task linking + dedupe support for notifications
ALTER TABLE "notifications"
ADD COLUMN "taskId" TEXT,
ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "tasks"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
