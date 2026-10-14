-- RoadmapBlock: geplante Spanne für leere Blöcke (Vorlage: ps/pe)
ALTER TABLE "RoadmapBlock" ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "endDate" TIMESTAMP(3);
