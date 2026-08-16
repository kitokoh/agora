import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Overview' };

export default function DashboardHome() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Your shop analytics (GMV, orders, conversion) arrive with M4. Onboarding
        to open your shop arrives with M1 (issue{' '}
        <a className="text-brand-600 underline" href="https://github.com/kitokoh/agora/issues/29">#29</a>).
      </p>
    </>
  );
}
