-- Add facebookId and instagramId to Customer for cross-channel matching
ALTER TABLE "Customer" ADD COLUMN "facebookId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Customer" ADD COLUMN "instagramId" TEXT NOT NULL DEFAULT '';

-- Create indexes for fast lookups
CREATE INDEX "Customer_facebookId_idx" ON "Customer"("facebookId");
CREATE INDEX "Customer_instagramId_idx" ON "Customer"("instagramId");
