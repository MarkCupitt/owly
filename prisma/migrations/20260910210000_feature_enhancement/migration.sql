-- Add upstream identity and customer identification settings
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityApiKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityApiKeyHeader" TEXT NOT NULL DEFAULT 'Authorization';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityApiKeyPrefix" TEXT NOT NULL DEFAULT 'Bearer ';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentitySystemLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityResponseUserIdField" TEXT NOT NULL DEFAULT 'user_id';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityResponseNameField" TEXT NOT NULL DEFAULT 'display_name';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityResponseFirstNameField" TEXT NOT NULL DEFAULT 'first_name';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityResponseLastNameField" TEXT NOT NULL DEFAULT 'last_name';
ALTER TABLE "Settings" ADD COLUMN "upstreamIdentityResponsePhotoField" TEXT NOT NULL DEFAULT 'photo_url';
ALTER TABLE "Settings" ADD COLUMN "customerIdentificationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Settings" ADD COLUMN "customerIdentificationPrompt" TEXT NOT NULL DEFAULT 'Are you already a {system_label} user? Please provide your registered email address. Or, to better help you and provide meaningful responses and docs, please provide your email address so we can better serve your enquiries.';
ALTER TABLE "Settings" ADD COLUMN "customerIdentificationFoundResponse" TEXT NOT NULL DEFAULT 'Thanks {name}! I''ve found your {system_label} account. How can I help you today?';
ALTER TABLE "Settings" ADD COLUMN "customerIdentificationNotFoundResponse" TEXT NOT NULL DEFAULT 'Thanks! I''ve noted your email. How can I help you today?';
ALTER TABLE "Settings" ADD COLUMN "fakeEmailDomains" TEXT NOT NULL DEFAULT 'facebook.com';

-- Add new Customer fields
ALTER TABLE "Customer" ADD COLUMN "externalId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN "externalSystem" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN "profilePicUrl" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Customer_externalId_externalSystem_idx" ON "Customer"("externalId", "externalSystem");

-- Create CustomerChannelLink table
CREATE TABLE "CustomerChannelLink" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerChannelLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerChannelLink_channel_externalId_key" ON "CustomerChannelLink"("channel", "externalId");
CREATE INDEX "CustomerChannelLink_customerId_idx" ON "CustomerChannelLink"("customerId");

ALTER TABLE "CustomerChannelLink" ADD CONSTRAINT "CustomerChannelLink_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE;

-- Create CustomerMatchProposal table
CREATE TABLE "CustomerMatchProposal" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "proposedMatchId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "CustomerMatchProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerMatchProposal_status_idx" ON "CustomerMatchProposal"("status");
CREATE INDEX "CustomerMatchProposal_customerId_idx" ON "CustomerMatchProposal"("customerId");
CREATE INDEX "CustomerMatchProposal_proposedMatchId_idx" ON "CustomerMatchProposal"("proposedMatchId");

-- Create Notification table
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "entityId" TEXT,
    "entityType" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Notification_type_isRead_idx" ON "Notification"("type", "isRead");
