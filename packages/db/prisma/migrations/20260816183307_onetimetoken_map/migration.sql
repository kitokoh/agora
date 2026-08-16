/*
  Warnings:

  - You are about to drop the `OneTimeToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "identity"."OneTimeToken" DROP CONSTRAINT "OneTimeToken_userId_fkey";

-- DropTable
DROP TABLE "identity"."OneTimeToken";

-- CreateTable
CREATE TABLE "identity"."one_time_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "identity"."TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "one_time_tokens_userId_purpose_idx" ON "identity"."one_time_tokens"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "identity"."one_time_tokens" ADD CONSTRAINT "one_time_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
