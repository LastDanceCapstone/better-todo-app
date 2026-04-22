-- Add Apple as a supported auth provider.
ALTER TYPE "AuthProvider" ADD VALUE IF NOT EXISTS 'apple';

-- Persist Apple subject identifier for stable returning logins.
ALTER TABLE "users"
ADD COLUMN "appleId" TEXT;

CREATE UNIQUE INDEX "users_appleId_key" ON "users"("appleId");
