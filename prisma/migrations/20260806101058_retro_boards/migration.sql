-- CreateTable
CREATE TABLE "Retro" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT true,
    "votesPerUser" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Retro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroColumn" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RetroColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroParticipant" (
    "id" TEXT NOT NULL,
    "retroId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "token" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "RetroParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroCard" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroComment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetroComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetroVote" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "RetroVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetroParticipant_token_key" ON "RetroParticipant"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RetroParticipant_retroId_name_key" ON "RetroParticipant"("retroId", "name");

-- AddForeignKey
ALTER TABLE "Retro" ADD CONSTRAINT "Retro_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroColumn" ADD CONSTRAINT "RetroColumn_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroParticipant" ADD CONSTRAINT "RetroParticipant_retroId_fkey" FOREIGN KEY ("retroId") REFERENCES "Retro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "RetroColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "RetroParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroComment" ADD CONSTRAINT "RetroComment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroComment" ADD CONSTRAINT "RetroComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "RetroParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "RetroParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
