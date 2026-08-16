'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiBaseUrl } from '@/components/auth/auth-form';

function ResetConfirmInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/auth/reset/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? 'Reset failed');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Password updated — all sessions were signed out.{' '}
        <a href="/login" className="font-medium underline">Sign in with your new password →</a>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Choose a new password</h1>
      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          New password (min 8 chars, letter + number)
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <button type="submit" className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Update password
        </button>
      </form>
    </>
  );
}

export default function ResetConfirmPage() {
  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
        <ResetConfirmInner />
      </Suspense>
    </main>
  );
}
