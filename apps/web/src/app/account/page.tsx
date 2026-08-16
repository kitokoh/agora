import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'My account' };

export default function AccountPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">My account</h1>
      <p className="mt-3 text-slate-600">
        Order history and profile settings arrive with the identity milestone (M1).
      </p>
    </main>
  );
}
