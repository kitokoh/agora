/*
  Warnings:

  - Added the required column `mfaBackupCodes` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "identity"."TokenPurpose" AS ENUM ('email_verification', 'password_reset');

-- AlterTable
ALTER TABLE "identity"."users" ADD COLUMN     "emailVerifiedAt" TIMESTAMPTZ,
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ,
ADD COLUMN     "mfaBackupCodes" JSONB NOT NULL,
ADD COLUMN     "mfaSecretEnc" TEXT;

-- CreateTable
CREATE TABLE "identity"."OneTimeToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "identity"."TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."audit_events" (
    "id" UUID NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "diff" JSONB NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneTimeToken_userId_purpose_idx" ON "identity"."OneTimeToken"("userId", "purpose");

-- CreateIndex
CREATE INDEX "audit_events_at_idx" ON "identity"."audit_events"("at");

-- CreateIndex
CREATE INDEX "audit_events_actorType_actorId_idx" ON "identity"."audit_events"("actorType", "actorId");

-- AddForeignKey
ALTER TABLE "identity"."OneTimeToken" ADD CONSTRAINT "OneTimeToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
