-- CreateTable
CREATE TABLE "CarryOverPlan" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "takeAlong" BOOLEAN NOT NULL DEFAULT true,
    "remainingPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarryOverPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CarryOverPlan_sprintId_jiraKey_key" ON "CarryOverPlan"("sprintId", "jiraKey");

-- AddForeignKey
ALTER TABLE "CarryOverPlan" ADD CONSTRAINT "CarryOverPlan_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
