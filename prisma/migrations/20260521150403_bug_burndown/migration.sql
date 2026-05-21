-- AlterTable
ALTER TABLE "BurndownPoint" ADD COLUMN     "remainingBugs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "issueType" TEXT NOT NULL DEFAULT '';
