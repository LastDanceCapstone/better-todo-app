-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "morningOverview" BOOLEAN NOT NULL DEFAULT false,
    "eveningReview" BOOLEAN NOT NULL DEFAULT false,
    "taskDueReminders" BOOLEAN NOT NULL DEFAULT false,
    "overdueTaskAlerts" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
