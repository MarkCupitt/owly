-- Add appName and appNameShort fields to Settings
ALTER TABLE "Settings" ADD COLUMN "appName" TEXT NOT NULL DEFAULT 'Owly';
ALTER TABLE "Settings" ADD COLUMN "appNameShort" TEXT NOT NULL DEFAULT 'Owly';
