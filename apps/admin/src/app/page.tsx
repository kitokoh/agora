import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Overview' };

export default function AdminHome() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Platform overview</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        KPIs and marketplace health arrive with M5. Moderation, KYC review,
        disputes, and audit consoles are scaffolded as routes below.
      </p>
    </>
  );
}
