-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "catalog";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "finance";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "marketplace";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notification";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "orders";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "payments";

-- CreateEnum
CREATE TYPE "identity"."UserStatus" AS ENUM ('unverified', 'active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "identity"."RoleScope" AS ENUM ('platform', 'shop');

-- CreateEnum
CREATE TYPE "marketplace"."ShopStatus" AS ENUM ('draft', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "marketplace"."BillingCycle" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "marketplace"."SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "marketplace"."KycState" AS ENUM ('not_started', 'draft', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "marketplace"."KycEntityType" AS ENUM ('individual', 'company');

-- CreateEnum
CREATE TYPE "catalog"."ProductStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "catalog"."MediaStatus" AS ENUM ('pending', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "orders"."CartStatus" AS ENUM ('open', 'checked_out', 'abandoned');

-- CreateEnum
CREATE TYPE "orders"."OrderStatus" AS ENUM ('placed', 'paid', 'fulfilled', 'completed', 'canceled', 'refunded');

-- CreateEnum
CREATE TYPE "payments"."PaymentStatus" AS ENUM ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled', 'failed');

-- CreateEnum
CREATE TYPE "finance"."LedgerAccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- CreateEnum
CREATE TYPE "finance"."EntryDirection" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "finance"."PayoutStatus" AS ENUM ('scheduled', 'processing', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "notification"."NotificationChannel" AS ENUM ('email', 'sms', 'in_app');

-- CreateEnum
CREATE TYPE "notification"."NotificationStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "identity"."UserStatus" NOT NULL DEFAULT 'unverified',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "passwordHash" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "kycState" "marketplace"."KycState" NOT NULL DEFAULT 'not_started',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "identity"."RoleScope" NOT NULL DEFAULT 'platform',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."role_assignments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "shopId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."permissions" (
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "identity"."role_permissions" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."shops" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoMediaId" UUID,
    "status" "marketplace"."ShopStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceMinor" BIGINT NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL,
    "billingCycle" "marketplace"."BillingCycle" NOT NULL DEFAULT 'monthly',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."shop_plan_subscriptions" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "marketplace"."SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "periodStart" TIMESTAMPTZ,
    "periodEnd" TIMESTAMPTZ,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_plan_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."commission_configs" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "categoryId" UUID,
    "percentBp" INTEGER NOT NULL DEFAULT 500,
    "fixedMinor" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "commission_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."seller_kyc" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "entityType" "marketplace"."KycEntityType" NOT NULL,
    "docsRefs" JSONB NOT NULL,
    "verificationState" "marketplace"."KycState" NOT NULL DEFAULT 'not_started',
    "verifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seller_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."reviews" (
    "id" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace"."disputes" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "openedBy" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "evidence" JSONB NOT NULL,
    "shopId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."products" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "catalog"."ProductStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "basePriceMinor" BIGINT NOT NULL,
    "media" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."variants" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "optionValues" JSONB NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "compareAtMinor" BIGINT,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."inventory_movements" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."categories" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributesSchema" JSONB NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog"."product_categories" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "catalog"."media_assets" (
    "id" UUID NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size" INTEGER NOT NULL,
    "checksum" TEXT,
    "status" "catalog"."MediaStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."carts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "orders"."CartStatus" NOT NULL DEFAULT 'open',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."cart_items" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."orders" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "buyerId" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "status" "orders"."OrderStatus" NOT NULL DEFAULT 'placed',
    "totals" JSONB NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "placedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order_lines" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "lineTotalMinor" BIGINT NOT NULL,
    "status" "orders"."OrderStatus" NOT NULL DEFAULT 'placed',

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders"."order_status_events" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "from" "orders"."OrderStatus" NOT NULL,
    "to" "orders"."OrderStatus" NOT NULL,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "reason" TEXT,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."payment_intents" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerPaymentId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "payments"."PaymentStatus" NOT NULL DEFAULT 'requires_payment_method',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments"."provider_accounts" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe_connect',
    "externalId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."ledger_accounts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "finance"."LedgerAccountType" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."journal_entries" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "memo" TEXT,
    "postedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."ledger_entries" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "direction" "finance"."EntryDirection" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" JSONB NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance"."payouts" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "providerPayoutId" TEXT,
    "grossMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL DEFAULT 0,
    "netMinor" BIGINT NOT NULL,
    "status" "finance"."PayoutStatus" NOT NULL DEFAULT 'scheduled',
    "period" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification"."notification_templates" (
    "id" UUID NOT NULL,
    "channel" "notification"."NotificationChannel" NOT NULL,
    "event" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification"."notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "notification"."NotificationChannel" NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "notification"."NotificationStatus" NOT NULL DEFAULT 'queued',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ,
    "referenceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification"."webhook_endpoints" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification"."webhook_deliveries" (
    "id" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."audit_events" (
    "id" UUID NOT NULL,
    "actorType" TEXT,
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
CREATE UNIQUE INDEX "users_email_key" ON "identity"."users"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "identity"."sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_familyId_idx" ON "identity"."sessions"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "identity"."roles"("name");

-- CreateIndex
CREATE INDEX "role_assignments_shopId_idx" ON "identity"."role_assignments"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_userId_roleId_shopId_key" ON "identity"."role_assignments"("userId", "roleId", "shopId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "identity"."role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "shops_slug_key" ON "marketplace"."shops"("slug");

-- CreateIndex
CREATE INDEX "shops_ownerId_idx" ON "marketplace"."shops"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "marketplace"."plans"("code");

-- CreateIndex
CREATE INDEX "shop_plan_subscriptions_shopId_status_idx" ON "marketplace"."shop_plan_subscriptions"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_kyc_shopId_key" ON "marketplace"."seller_kyc"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderLineId_key" ON "marketplace"."reviews"("orderLineId");

-- CreateIndex
CREATE INDEX "reviews_productId_idx" ON "marketplace"."reviews"("productId");

-- CreateIndex
CREATE INDEX "reviews_shopId_status_idx" ON "marketplace"."reviews"("shopId", "status");

-- CreateIndex
CREATE INDEX "disputes_orderId_idx" ON "marketplace"."disputes"("orderId");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "catalog"."products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "products_shopId_slug_key" ON "catalog"."products"("shopId", "slug");

-- CreateIndex
CREATE INDEX "variants_productId_idx" ON "catalog"."variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "variants_shopId_sku_key" ON "catalog"."variants"("shopId", "sku");

-- CreateIndex
CREATE INDEX "inventory_movements_variantId_idx" ON "catalog"."inventory_movements"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "catalog"."categories"("slug");

-- CreateIndex
CREATE INDEX "media_assets_ownerType_ownerId_idx" ON "catalog"."media_assets"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "carts_userId_status_idx" ON "orders"."carts"("userId", "status");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "orders"."cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"."orders"("number");

-- CreateIndex
CREATE INDEX "orders_buyerId_idx" ON "orders"."orders"("buyerId");

-- CreateIndex
CREATE INDEX "orders_shopId_status_idx" ON "orders"."orders"("shopId", "status");

-- CreateIndex
CREATE INDEX "order_lines_orderId_idx" ON "orders"."order_lines"("orderId");

-- CreateIndex
CREATE INDEX "order_status_events_orderId_idx" ON "orders"."order_status_events"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_idempotencyKey_key" ON "payments"."payment_intents"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_intents_orderId_idx" ON "payments"."payment_intents"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_accounts_shopId_provider_key" ON "payments"."provider_accounts"("shopId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "finance"."ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reference_key" ON "finance"."journal_entries"("reference");

-- CreateIndex
CREATE INDEX "ledger_entries_journalId_idx" ON "finance"."ledger_entries"("journalId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_idx" ON "finance"."ledger_entries"("accountId");

-- CreateIndex
CREATE INDEX "payouts_shopId_status_idx" ON "finance"."payouts"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_channel_event_locale_version_key" ON "notification"."notification_templates"("channel", "event", "locale", "version");

-- CreateIndex
CREATE INDEX "notifications_status_nextAttemptAt_idx" ON "notification"."notifications"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_event_referenceId_key" ON "notification"."notifications"("userId", "event", "referenceId");

-- CreateIndex
CREATE INDEX "webhook_endpoints_shopId_idx" ON "notification"."webhook_endpoints"("shopId");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpointId_createdAt_idx" ON "notification"."webhook_deliveries"("endpointId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_at_idx" ON "audit"."audit_events"("at");

-- CreateIndex
CREATE INDEX "audit_events_actorType_actorId_idx" ON "audit"."audit_events"("actorType", "actorId");

-- CreateIndex
CREATE INDEX "audit_events_resourceType_resourceId_idx" ON "audit"."audit_events"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_assignments" ADD CONSTRAINT "role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "identity"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "identity"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "identity"."permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."shop_plan_subscriptions" ADD CONSTRAINT "shop_plan_subscriptions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "marketplace"."shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."shop_plan_subscriptions" ADD CONSTRAINT "shop_plan_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "marketplace"."plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."commission_configs" ADD CONSTRAINT "commission_configs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "marketplace"."shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."seller_kyc" ADD CONSTRAINT "seller_kyc_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "marketplace"."shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."reviews" ADD CONSTRAINT "reviews_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "marketplace"."shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace"."disputes" ADD CONSTRAINT "disputes_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "marketplace"."shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."variants" ADD CONSTRAINT "variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "catalog"."variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "catalog"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog"."product_categories" ADD CONSTRAINT "product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "catalog"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "orders"."carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders"."order_status_events" ADD CONSTRAINT "order_status_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "finance"."journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance"."ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance"."ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "notification"."webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
