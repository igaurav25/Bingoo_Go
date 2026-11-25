-- Additive IPL-Style Friends Tournament metadata columns
ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "registrationDeadline" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "minParticipants" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "matchesPerPlayer" INTEGER,
  ADD COLUMN IF NOT EXISTS "joinUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "requireReadyToStart" BOOLEAN NOT NULL DEFAULT false;
