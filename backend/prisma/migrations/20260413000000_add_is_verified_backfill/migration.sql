ALTER TABLE "users"
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "isVerified" = true;
