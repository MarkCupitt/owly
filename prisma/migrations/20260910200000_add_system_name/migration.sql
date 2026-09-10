-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "systemName" TEXT NOT NULL DEFAULT 'HelpDesk';

-- Update existing defaults from Owly to HelpDesk
UPDATE "Settings" SET "appName" = 'HelpDesk' WHERE "appName" = 'Owly';
UPDATE "Settings" SET "appNameShort" = 'HelpDesk' WHERE "appNameShort" = 'Owly';
