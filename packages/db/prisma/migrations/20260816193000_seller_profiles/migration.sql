-- CreateTable
CREATE TABLE "identity"."seller_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_userId_key" ON "identity"."seller_profiles"("userId");

-- AddForeignKey
ALTER TABLE "identity"."seller_profiles" ADD CONSTRAINT "seller_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

