-- Team: Daily-Zeitpunkt für den Burndown-Snapshot
ALTER TABLE "Team" ADD COLUMN "dailyDays" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Team" ADD COLUMN "dailyTime" TEXT;

-- CarryOverPlan: Zielsprint + Snapshot
ALTER TABLE "CarryOverPlan" ADD COLUMN "targetSprintId" TEXT;
ALTER TABLE "CarryOverPlan" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CarryOverPlan" ADD COLUMN "storyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CarryOverPlan" ADD CONSTRAINT "CarryOverPlan_targetSprintId_fkey"
  FOREIGN KEY ("targetSprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "CarryOverPlan_targetSprintId_idx" ON "CarryOverPlan"("targetSprintId");

-- Altbestand: Snapshot aus den Issues des Quellsprints …
UPDATE "CarryOverPlan" c
SET "summary" = i."summary", "storyPoints" = i."storyPoints"
FROM "Issue" i
WHERE i."sprintId" = c."sprintId" AND i."jiraKey" = c."jiraKey";

-- … und Ziel = der nächste Sprint des Teams nach dem Quellsprint.
UPDATE "CarryOverPlan" c
SET "targetSprintId" = (
  SELECT n."id" FROM "Sprint" n
  JOIN "Sprint" s ON s."id" = c."sprintId"
  WHERE n."teamId" = s."teamId" AND n."id" <> s."id"
    AND n."startDate" IS NOT NULL AND s."startDate" IS NOT NULL
    AND n."startDate" > s."startDate"
  ORDER BY n."startDate" ASC
  LIMIT 1
);

-- Markierungen im laufenden Sprint: Ziel = der geplante Sprint, den das Planning zeigt
-- (frühestes Startdatum, sonst Name) — geplante Sprints haben oft noch kein Startdatum.
UPDATE "CarryOverPlan" c
SET "targetSprintId" = (
  SELECT n."id" FROM "Sprint" n
  JOIN "Sprint" s ON s."id" = c."sprintId"
  WHERE n."teamId" = s."teamId" AND n."state" = 'FUTURE'
  ORDER BY n."startDate" ASC NULLS LAST, n."name" ASC
  LIMIT 1
)
WHERE c."targetSprintId" IS NULL
  AND EXISTS (SELECT 1 FROM "Sprint" s WHERE s."id" = c."sprintId" AND s."state" = 'ACTIVE');

-- Retro: Teilnehmer meldet sich fertig
ALTER TABLE "RetroParticipant" ADD COLUMN "done" BOOLEAN NOT NULL DEFAULT false;
