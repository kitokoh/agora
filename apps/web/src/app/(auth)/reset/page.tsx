'use client';

import { useState, type FormEvent } from 'react';
import { apiBaseUrl } from '@/components/auth/auth-form';

export default function ResetRequestPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/auth/reset/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? 'Request failed');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  if (sent) {
    return (
      <main id="main" className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Check your inbox</h1>
        <p className="text-sm text-slate-600">
          If an account exists for that email, a reset link is on its way (valid 1 hour).
        </p>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Reset your password</h1>
      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <button type="submit" className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Send reset link
        </button>
      </form>
    </main>
  );
}
