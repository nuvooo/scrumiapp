-- AlterTable
ALTER TABLE "Retro" ADD COLUMN     "sortMode" TEXT NOT NULL DEFAULT 'default',
ADD COLUMN     "sortOrder" TEXT NOT NULL DEFAULT '[]';
