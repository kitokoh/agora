# apps/

Customer-facing applications. Next.js 15 (App Router), TypeScript strict,
sharing the `@agora/ui` design system and the typed SDK generated from
`packages/contracts`.

| App | Audience | Scope |
| --- | --- | --- |
| `web` | Buyers | Marketplace browse/search, product pages, storefronts, cart, checkout, account |
| `dashboard` | Sellers | Catalog, inventory, orders, fulfillment, payouts, analytics, plans |
| `admin` | Platform staff | Moderation, disputes, KYC, payouts approval, audit, platform config |

Bootstrap targets (M0): each app runs with `pnpm dev`, health page, auth
middleware stub, design-system smoke page.
