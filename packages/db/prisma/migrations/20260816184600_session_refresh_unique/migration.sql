-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshTokenHash_key" ON "identity"."sessions"("refreshTokenHash");

