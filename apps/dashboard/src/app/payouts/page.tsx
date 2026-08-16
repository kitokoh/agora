import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Payouts' };

export default function PayoutsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Payout history and Stripe Connect onboarding arrive with M4.
      </p>
    </>
  );
}
