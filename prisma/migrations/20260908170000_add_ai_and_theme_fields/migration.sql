-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "aiBaseUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "themePreset" TEXT NOT NULL DEFAULT 'owly-default';
ALTER TABLE "Settings" ADD COLUMN "themeOverrides" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Settings" ADD COLUMN "themeLogoUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "themeLogoDarkUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "themeFaviconUrl" TEXT NOT NULL DEFAULT '';
