-- Roadmap: Monatsraster → tagesgenau (Endmonat wird zum letzten Monatstag)
ALTER TABLE "Roadmap" RENAME COLUMN "startMonth" TO "startDate";
ALTER TABLE "Roadmap" RENAME COLUMN "endMonth" TO "endDate";
UPDATE "Roadmap" SET "endDate" = ("endDate" + INTERVAL '1 month' - INTERVAL '1 day');

-- RoadmapItem: tagesgenau, Block-Zuordnung, Abhängigkeiten
ALTER TABLE "RoadmapItem" RENAME COLUMN "startMonth" TO "startDate";
ALTER TABLE "RoadmapItem" RENAME COLUMN "endMonth" TO "endDate";
UPDATE "RoadmapItem" SET "endDate" = ("endDate" + INTERVAL '1 month' - INTERVAL '1 day');
ALTER TABLE "RoadmapItem" ADD COLUMN "blockId" TEXT,
ADD COLUMN "blockedBy" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- RoadmapMilestone: Monat → Tag
ALTER TABLE "RoadmapMilestone" RENAME COLUMN "month" TO "date";

-- CreateTable
CREATE TABLE "RoadmapBlock" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "hue" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RoadmapBlock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoadmapBlock" ADD CONSTRAINT "RoadmapBlock_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapBlock" ADD CONSTRAINT "RoadmapBlock_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "RoadmapBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "RoadmapBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
