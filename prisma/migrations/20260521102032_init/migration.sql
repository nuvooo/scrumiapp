-- CreateEnum
CREATE TYPE "SprintState" AS ENUM ('ACTIVE', 'CLOSED', 'FUTURE');

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jiraBoardId" TEXT NOT NULL,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "jiraSprintId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "SprintState" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "completeDate" TIMESTAMP(3),
    "committedPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "storyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "statusCategory" "StatusCategory" NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "addedAfterSprintStart" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BurndownPoint" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "remainingPoints" DOUBLE PRECISION NOT NULL,
    "completedPoints" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BurndownPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapacityEntry" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "teamMemberId" TEXT,
    "name" TEXT NOT NULL,
    "personDays" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CapacityEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_teamId_jiraSprintId_key" ON "Sprint"("teamId", "jiraSprintId");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_sprintId_jiraKey_key" ON "Issue"("sprintId", "jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "BurndownPoint_sprintId_date_key" ON "BurndownPoint"("sprintId", "date");

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BurndownPoint" ADD CONSTRAINT "BurndownPoint_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityEntry" ADD CONSTRAINT "CapacityEntry_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapacityEntry" ADD CONSTRAINT "CapacityEntry_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
