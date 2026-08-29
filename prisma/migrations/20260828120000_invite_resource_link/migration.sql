-- AlterTable
ALTER TABLE "organization_invites" ADD COLUMN "resourceId" TEXT;

-- CreateIndex
CREATE INDEX "organization_invites_resourceId_idx" ON "organization_invites"("resourceId");

-- AddForeignKey
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
