-- AlterTable
ALTER TABLE "Retro" ADD COLUMN     "timerEndsAt" TIMESTAMP(3),
ADD COLUMN     "votingOpen" BOOLEAN NOT NULL DEFAULT false;
