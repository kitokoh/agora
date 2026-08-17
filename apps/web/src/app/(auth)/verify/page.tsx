'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiBaseUrl } from '@/components/auth/auth-form';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const sent = params.get('sent');
  const [state, setState] = useState<'idle' | 'working' | 'ok' | 'error'>(sent ? 'idle' : 'working');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || state !== 'working') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${apiBaseUrl()}/v1/auth/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });
        const body = (await res.json().catch(() => null)) as { status?: string; error?: { message?: string } } | null;
        if (cancelled) return;
        if (res.ok && body?.status === 'verified') {
          setState('ok');
          setMessage('Your email is verified — you can sign in now.');
        } else {
          setState('error');
          setMessage(body?.error?.message ?? 'Verification failed. The link may be invalid or expired.');
        }
      } catch {
        if (!cancelled) {
          setState('error');
          setMessage('Could not reach the verification service.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, state]);

  if (state === 'ok') {
    return (
      <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        {message} <a href="/login" className="font-medium underline">Sign in →</a>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {message} <a href="/verify/resend" className="font-medium underline">Request a new link</a>
      </div>
    );
  }
  return <p className="text-sm text-slate-600">{message || 'Verifying your email…'}</p>;
}

export default function VerifyPage() {
  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Verify your email</h1>
      <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
        <VerifyInner />
      </Suspense>
    </main>
  );
}
