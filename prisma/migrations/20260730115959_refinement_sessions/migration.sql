-- CreateEnum
CREATE TYPE "RefinementState" AS ENUM ('DRAFT', 'RUNNING', 'DONE');

-- CreateEnum
CREATE TYPE "RefinementTicketState" AS ENUM ('PENDING', 'VOTING', 'REVEALED', 'ESTIMATED');

-- CreateTable
CREATE TABLE "Refinement" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "RefinementState" NOT NULL DEFAULT 'DRAFT',
    "activeTicketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refinement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementTicket" (
    "id" TEXT NOT NULL,
    "refinementId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issueType" TEXT NOT NULL DEFAULT '',
    "previousPoints" DOUBLE PRECISION,
    "position" INTEGER NOT NULL,
    "state" "RefinementTicketState" NOT NULL DEFAULT 'PENDING',
    "finalPoints" DOUBLE PRECISION,

    CONSTRAINT "RefinementTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementParticipant" (
    "id" TEXT NOT NULL,
    "refinementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,

    CONSTRAINT "RefinementParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefinementVote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "points" DOUBLE PRECISION,

    CONSTRAINT "RefinementVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefinementTicket_refinementId_jiraKey_key" ON "RefinementTicket"("refinementId", "jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "RefinementParticipant_token_key" ON "RefinementParticipant"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RefinementParticipant_refinementId_name_key" ON "RefinementParticipant"("refinementId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RefinementVote_ticketId_participantId_key" ON "RefinementVote"("ticketId", "participantId");

-- AddForeignKey
ALTER TABLE "Refinement" ADD CONSTRAINT "Refinement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementTicket" ADD CONSTRAINT "RefinementTicket_refinementId_fkey" FOREIGN KEY ("refinementId") REFERENCES "Refinement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementParticipant" ADD CONSTRAINT "RefinementParticipant_refinementId_fkey" FOREIGN KEY ("refinementId") REFERENCES "Refinement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementVote" ADD CONSTRAINT "RefinementVote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RefinementTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefinementVote" ADD CONSTRAINT "RefinementVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "RefinementParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
