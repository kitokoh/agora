#!/usr/bin/env bash
# ============================================================================
# Agora — local environment initialization
#
# 1. Waits for all compose services to be healthy
# 2. Creates the MinIO bucket (agora-media) using the container's `mc`
# 3. Creates the Meilisearch index (products) with faceted settings
# 4. Applies DB migrations + seeds baseline data (roles, permissions, plans)
#
# Usage: make init   (or)   ./scripts/init-local.sh
# Requires: docker compose v2, a running `docker compose up -d`
# ============================================================================
set -euo pipefail

COMPOSE=(docker compose)
if ! "${COMPOSE[@]}" version >/dev/null 2>&1; then
  echo "error: docker compose v2 is required (see docs/operations.md)" >&2
  exit 1
fi

echo "==> Waiting for services to be healthy…"
for service in postgres redis minio meilisearch; do
  "${COMPOSE[@]}" up -d "$service" >/dev/null
  # docker compose healthcheck status via inspect
  for _ in $(seq 1 60); do
    health=$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}' | awk -v s="$service" '$1==s {print $2}')
    if [ "$health" = "healthy" ]; then
      break
    fi
    sleep 2
  done
  health=$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}' | awk -v s="$service" '$1==s {print $2}')
  if [ "$health" != "healthy" ]; then
    echo "error: $service did not become healthy" >&2
    exit 1
  fi
  echo "    ✓ $service healthy"
done

echo "==> Creating MinIO bucket 'agora-media'…"
"${COMPOSE[@]}" exec -T minio mc alias set local http://localhost:9000 agora agora-secret >/dev/null
if ! "${COMPOSE[@]}" exec -T minio mc ls local/agora-media >/dev/null 2>&1; then
  "${COMPOSE[@]}" exec -T minio mc mb local/agora-media
  echo "    ✓ bucket created"
else
  echo "    ✓ bucket already exists"
fi

echo "==> Creating Meilisearch index 'products'…"
MEILI_ADMIN_KEY="${MEILI_MASTER_KEY:-agora-master-key}"
INDEX_JSON='{"uid":"products","primaryKey":"id","filterableAttributes":["shop_id","category_ids","status","price_minor"],"sortableAttributes":["price_minor","created_at"],"typoTolerance":{"enabled":true}}'
if curl -sf -o /dev/null -H "Authorization: Bearer $MEILI_ADMIN_KEY" \
  -X GET "http://localhost:7700/indexes/products"; then
  echo "    ✓ index already exists"
else
  curl -sf -X POST "http://localhost:7700/indexes" \
    -H "Authorization: Bearer $MEILI_ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d "$INDEX_JSON" >/dev/null
  echo "    ✓ index created"
fi

echo "==> Applying DB migrations + seeds…"
pnpm db:generate >/dev/null
pnpm db:migrate
pnpm --filter @agora/db seed

echo ""
echo "✅ Local environment ready:"
echo "   API        http://localhost:4000  (pnpm --filter @agora/api dev)"
echo "   Postgres   localhost:5432         agora/agora"
echo "   Redis      localhost:6379"
echo "   MinIO      http://localhost:9001  agora/agora-secret"
echo "   Meilisearch http://localhost:7700 (master key: $MEILI_ADMIN_KEY)"
