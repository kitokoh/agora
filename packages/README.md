# packages/ & services/

## packages (shared libraries)

| Package | Purpose |
| --- | --- |
| `@agora/ui` | Design system: Radix + Tailwind, Storybook, a11y (ADR-0012) |
| `@agora/contracts` | Zod schemas → OpenAPI 3.1, the single source of truth (ADR-0011) |
| `@agora/db` | Prisma schema + migrations (ADR-0003) |
| `@agora/sdk` | Typed client SDK for frontends and partners |
| `@agora/config` | Shared eslint/ts/prettier/tailwind presets |
| `@agora/queue` | BullMQ workers + job contracts (ADR-0005) |
| `@agora/observability` | OTel bootstrap, pino config, health endpoints (ADR-0009) |

## services

| Service | Purpose |
| --- | --- |
| `services/api` | Backend modular monolith — 11 bounded contexts (ADR-0002) |

New packages/services require an ADR or an explicit mention in an approved
plan before creation.
