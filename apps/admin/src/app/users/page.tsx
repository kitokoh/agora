import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Scaffolded in M0; implemented with the trust &amp; admin milestone (M5).</p>
    </>
  );
}
