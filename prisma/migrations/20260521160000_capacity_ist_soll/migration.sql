-- Add new columns
ALTER TABLE "CapacityEntry" ADD COLUMN "plannedPersonDays" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CapacityEntry" ADD COLUMN "actualPersonDays" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Carry existing personDays into both planned and actual
UPDATE "CapacityEntry" SET "plannedPersonDays" = "personDays", "actualPersonDays" = "personDays";

-- Drop old column
ALTER TABLE "CapacityEntry" DROP COLUMN "personDays";

-- Unique key for upsert by (sprint, member)
CREATE UNIQUE INDEX "CapacityEntry_sprintId_teamMemberId_key" ON "CapacityEntry"("sprintId", "teamMemberId");
