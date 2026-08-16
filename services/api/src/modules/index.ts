import type { FastifyInstance } from 'fastify';

/**
 * A bounded-context module inside the modular monolith (docs/architecture.md §3.2).
 *
 * Each module owns its tables, its public facade, and its events. Modules
 * are registered into the API in `registerModules` below.
 */
export interface AgoraModule {
  name: string;
  register: (app: FastifyInstance) => Promise<void> | void;
}

/**
 * Module registry — the ordered list of bounded contexts mounted on the API.
 *
 * As each module is implemented (identity first, M1), its placeholder here
 * is replaced by the real module and its routes become live under /v1.
 * Keep the order stable: identity must be registered before middleware
 * modules (authn/authz) that depend on it.
 */
export const appModules: AgoraModule[] = [
  // identity    — users, credentials, sessions, MFA, RBAC, audit (M1)
  // marketplace — shops, plans, commissions, KYC (M1 onboarding subset)
  // catalog     — products, variants, SKUs, categories (M2)
  // search-indexer — read-side Meilisearch projection (M2)
  // cart        — carts, cart items, price snapshots (M3)
  // orders      — orders, state machine, refunds (M3)
  // payments    — Stripe adapters, webhooks, idempotency (M3)
  // finance     — double-entry ledger, escrow, payouts (M3)
  // fulfillment — shipping methods, labels, tracking (M4)
  // notifications — templates, email/SMS/in-app outbound (M1 scaffold)
  // admin       — moderation, disputes, KYC review, audit queries (M5)
];

/** Mount all implemented modules onto the app. */
export async function registerModules(app: FastifyInstance): Promise<void> {
  for (const module of appModules) {
    app.log.info({ module: module.name }, 'registering module');
    await module.register(app);
  }
}
