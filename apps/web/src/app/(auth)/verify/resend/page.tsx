'use client';

import { useState, type FormEvent } from 'react';
import { apiBaseUrl } from '@/components/auth/auth-form';

export default function ResendPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    await fetch(`${apiBaseUrl()}/v1/auth/verify/resend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSent(true);
  }

  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Resend verification email</h1>
      {sent ? (
        <p role="status" className="text-sm text-emerald-700">If the account exists, a new verification link has been sent.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none" />
          </label>
          <button type="submit" className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Resend
          </button>
        </form>
      )}
    </main>
  );
}
