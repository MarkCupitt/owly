-- AlterTable: Add custom webhook channel fields
ALTER TABLE "Channel" ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Channel" ADD COLUMN "displayName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Channel" ADD COLUMN "outboundWebhookUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Channel" ADD COLUMN "outboundWebhookHeaders" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Channel" ADD COLUMN "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Channel" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "Channel" ADD COLUMN "disabledReason" TEXT NOT NULL DEFAULT '';

-- AlterTable: Add global auto-reply setting
ALTER TABLE "Settings" ADD COLUMN "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true;
