-- Drop the old single overrides column
ALTER TABLE "Settings" DROP COLUMN "themeOverrides";

-- Add separate light and dark override columns
ALTER TABLE "Settings" ADD COLUMN "themeOverridesLight" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Settings" ADD COLUMN "themeOverridesDark" JSONB NOT NULL DEFAULT '{}';
