# ============================================================================
# Agora — developer Makefile
# Targets mirror the quickstart in README.md. See docs/operations.md.
# ============================================================================

.PHONY: help up down logs ps init dev build lint typecheck test db-migrate db-seed clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Start local infra (postgres, redis, minio, meilisearch)
	docker compose up -d

down: ## Stop local infra (keeps volumes)
	docker compose down

ps: ## Show service health
	docker compose ps

logs: ## Tail infra logs
	docker compose logs -f

init: ## Full local init: infra + buckets/indexes + migrations + seeds
	./scripts/init-local.sh

dev: ## Run the full dev stack (API + web + dashboard + admin) via turbo
	pnpm dev

db-migrate: ## Apply DB migrations
	pnpm db:migrate

db-seed: ## Seed baseline data (idempotent)
	pnpm --filter @agora/db seed

build: ## Build all packages and apps
	pnpm build

lint: ## Lint all workspaces
	pnpm lint

typecheck: ## Typecheck all workspaces
	pnpm typecheck

test: ## Run all tests
	pnpm test

clean: ## Remove build artifacts and node_modules
	rm -rf apps/*/.next apps/*/dist packages/*/dist services/*/dist node_modules
