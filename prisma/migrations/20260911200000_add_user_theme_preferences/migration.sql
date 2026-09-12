-- AlterTable: Add per-user theme preferences to Admin
ALTER TABLE "Admin" ADD COLUMN "themePreset" TEXT NOT NULL DEFAULT 'owly-default';
ALTER TABLE "Admin" ADD COLUMN "themeOverridesLight" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Admin" ADD COLUMN "themeOverridesDark" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Admin" ADD COLUMN "themeMode" TEXT NOT NULL DEFAULT 'system';
