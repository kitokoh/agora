# ADR-0012: Frontend — Next.js 15 + Radix/Tailwind Design System

- **Status**: accepted
- **Date**: 2026-08-14

## Context

Three applications (buyer marketplace/storefronts, seller dashboard, admin
console) share design language and components. SEO matters for storefronts;
a11y is non-negotiable; agents must build UI fast without design drift.

## Decision

- **Next.js 15 (App Router, RSC)** for `web`, `dashboard`, `admin` —
  shared monorepo config, per-app Tailwind theme tokens.
- **`packages/ui`**: design system on **Radix UI** primitives + Tailwind;
  Storybook catalog; dark mode; a11y (WCAG 2.1 AA) enforced in review.
- Storefront pages of `web` are SSG/ISR for SEO; app-like areas (cart,
  checkout) client components; data via the typed SDK from contracts.
- PWA-ready (M6); Core Web Vitals budgets in CI.

## Consequences

- One component language across three apps; tokens keep branding coherent.
- Next.js is the hiring/agent-familiar default with strong docs.
- Cost: RSC/Next complexity — mitigated by keeping pages thin and logic in
  the SDK/services.

## Alternatives

- Remix/SvelteKit: viable; Next chosen for ecosystem + AI-agent familiarity.
- Vite SPA only: rejected (SEO for storefronts).
