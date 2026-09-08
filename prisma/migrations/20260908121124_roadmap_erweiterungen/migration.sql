-- AlterTable
ALTER TABLE "RoadmapItem" ADD COLUMN     "assignee" TEXT,
ADD COLUMN     "storyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RoadmapLabel" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RoadmapLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapMilestone" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "RoadmapMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoadmapItemToRoadmapLabel" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoadmapItemToRoadmapLabel_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_RoadmapItemToRoadmapLabel_B_index" ON "_RoadmapItemToRoadmapLabel"("B");

-- AddForeignKey
ALTER TABLE "RoadmapLabel" ADD CONSTRAINT "RoadmapLabel_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapMilestone" ADD CONSTRAINT "RoadmapMilestone_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoadmapItemToRoadmapLabel" ADD CONSTRAINT "_RoadmapItemToRoadmapLabel_A_fkey" FOREIGN KEY ("A") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoadmapItemToRoadmapLabel" ADD CONSTRAINT "_RoadmapItemToRoadmapLabel_B_fkey" FOREIGN KEY ("B") REFERENCES "RoadmapLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
