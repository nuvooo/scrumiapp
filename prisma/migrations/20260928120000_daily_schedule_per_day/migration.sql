-- Daily: eigene Uhrzeit pro Wochentag statt einer Uhrzeit für alle Tage
ALTER TABLE "Team" ADD COLUMN "dailySchedule" TEXT NOT NULL DEFAULT '{}';

-- Bisherige Einstellung übernehmen: jeder gewählte Tag bekommt die gemeinsame Uhrzeit
UPDATE "Team"
SET "dailySchedule" = (
  SELECT COALESCE(json_object_agg(d, "dailyTime")::text, '{}')
  FROM unnest(string_to_array("dailyDays", ',')) AS d
  WHERE d <> ''
)
WHERE "dailyTime" IS NOT NULL AND "dailyDays" <> '';

ALTER TABLE "Team" DROP COLUMN "dailyDays";
ALTER TABLE "Team" DROP COLUMN "dailyTime";
