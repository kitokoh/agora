import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Authentication lands with the identity milestone (M1) — see issue{' '}
        <a className="text-brand-600 underline" href="https://github.com/kitokoh/agora/issues/23">
          #23
        </a>
        .
      </p>
    </main>
  );
}
