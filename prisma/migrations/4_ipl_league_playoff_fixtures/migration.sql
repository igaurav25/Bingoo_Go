-- Explicit IPL LeagueFixture, PlayoffFixture & Standings H2H columns
ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "playoffFormat" TEXT NOT NULL DEFAULT 'IPL_TOP4';

ALTER TABLE "TournamentStanding"
  ADD COLUMN IF NOT EXISTS "avatar" TEXT NOT NULL DEFAULT '🦊',
  ADD COLUMN IF NOT EXISTS "winRate" TEXT NOT NULL DEFAULT '0%',
  ADD COLUMN IF NOT EXISTS "h2hSummary" TEXT NOT NULL DEFAULT '-';

CREATE TABLE IF NOT EXISTS "LeagueFixture" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL DEFAULT 1,
  "roundName" TEXT NOT NULL,
  "fixtureIndex" INTEGER NOT NULL DEFAULT 0,
  "player1Id" TEXT,
  "player2Id" TEXT,
  "player1Score" INTEGER NOT NULL DEFAULT 0,
  "player2Score" INTEGER NOT NULL DEFAULT 0,
  "winnerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "roomCode" TEXT,
  CONSTRAINT "LeagueFixture_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PlayoffFixture" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tournamentId" TEXT NOT NULL,
  "playoffStage" TEXT NOT NULL,
  "roundName" TEXT NOT NULL,
  "fixtureIndex" INTEGER NOT NULL DEFAULT 0,
  "player1Id" TEXT,
  "player2Id" TEXT,
  "player1Score" INTEGER NOT NULL DEFAULT 0,
  "player2Score" INTEGER NOT NULL DEFAULT 0,
  "winnerId" TEXT,
  "loserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'WAITING',
  "winnerAdvancesToId" TEXT,
  "winnerAdvancesSlot" INTEGER,
  "loserAdvancesToId" TEXT,
  "loserAdvancesSlot" INTEGER,
  "roomCode" TEXT,
  CONSTRAINT "PlayoffFixture_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
