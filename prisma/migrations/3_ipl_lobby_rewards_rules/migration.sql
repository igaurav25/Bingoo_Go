-- Add IPL-style Lobby, MatchParticipant, MatchResult, TournamentReward, TournamentEvent & Rules columns
ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "lobbyCode" TEXT,
  ADD COLUMN IF NOT EXISTS "disconnectRule" TEXT NOT NULL DEFAULT 'PAUSE_60S',
  ADD COLUMN IF NOT EXISTS "timeoutRule" TEXT NOT NULL DEFAULT 'AUTO_PICK',
  ADD COLUMN IF NOT EXISTS "drawRule" TEXT NOT NULL DEFAULT 'TIEBREAKER',
  ADD COLUMN IF NOT EXISTS "abandonedRule" TEXT NOT NULL DEFAULT 'HOST_REVIEW';

ALTER TABLE "TournamentParticipant"
  ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "qualificationStatus" TEXT NOT NULL DEFAULT 'REGISTERED';

CREATE TABLE IF NOT EXISTS "TournamentLobby" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL UNIQUE,
  "roomCode" TEXT NOT NULL,
  "joinUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "maxCapacity" INTEGER NOT NULL DEFAULT 8,
  "onlineCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentLobby_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MatchParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentMatchId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar" TEXT NOT NULL DEFAULT '🦊',
  "seed" INTEGER,
  "score" INTEGER NOT NULL DEFAULT 0,
  "isWinner" BOOLEAN NOT NULL DEFAULT false,
  "qualificationStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "MatchParticipant_tournamentMatchId_fkey" FOREIGN KEY ("tournamentMatchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MatchParticipant_tournamentMatchId_playerId_key" UNIQUE ("tournamentMatchId", "playerId")
);

CREATE TABLE IF NOT EXISTS "MatchResult" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentMatchId" TEXT NOT NULL UNIQUE,
  "winnerId" TEXT NOT NULL,
  "loserId" TEXT,
  "scoresJson" TEXT NOT NULL DEFAULT '[5,0]',
  "winReason" TEXT NOT NULL DEFAULT 'BINGO_5_LINES',
  "verifiedByServer" BOOLEAN NOT NULL DEFAULT true,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchResult_tournamentMatchId_fkey" FOREIGN KEY ("tournamentMatchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TournamentReward" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "placement" INTEGER NOT NULL,
  "coinsAwarded" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'AWARDED',
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentReward_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TournamentReward_tournamentId_recipientId_placement_key" UNIQUE ("tournamentId", "recipientId", "placement")
);

CREATE TABLE IF NOT EXISTS "TournamentEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorId" TEXT,
  "payloadJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentEvent_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
