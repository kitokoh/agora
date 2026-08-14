# ADR-0006: Payments via Stripe + Split Payouts + Double-Entry Ledger

- **Status**: accepted
- **Date**: 2026-08-14

## Context

The platform takes money from buyers, holds it in escrow, takes a
commission, and pays sellers. Integrity is non-negotiable; PCI scope must
be minimal; new providers (PayPal, mobile money) will arrive.

## Decision

- **Stripe** primary PSP: PaymentIntents for checkout, **Connect** for
  seller onboarding and split payouts (platform ↔ seller funds).
  PCI scope = SAQ-A (hosted fields/redirect; card data never touches us).
- **Provider abstraction** (`IPaymentProvider`) so PayPal/mobile-money
  adapters can be added behind the same interface (ADR-0009-ish design
  principle: port/adapters).
- **Double-entry ledger module**: chart of accounts, journal entries,
  escrow account per shop, commission split at capture, payouts on
  settlement schedule. Webhooks are the source of truth for payment state;
  idempotency keys on all mutations.
- Money stored as integer minor units only.

## Consequences

- Money moves are auditable and reconcilable (`ledger-drift` runbook).
- Buyer funds never mingle with operating funds beyond escrow mechanics.
- Multi-provider support costs an adapter each; Stripe remains the
  reference implementation used in tests (sandbox).

## Alternatives

- Single direct Stripe charge without escrow: rejected (no platform
  economics, no trust for sellers).
- Bespoke PSP integration: rejected (PCI/ops burden).
