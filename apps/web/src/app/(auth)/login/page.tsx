'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiBaseUrl } from '@/components/auth/auth-form';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [challenge, setChallenge] = useState<{ challenge: string; userId: string } | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json().catch(() => null)) as
        | { accessToken?: string; refreshToken?: string; mfaRequired?: boolean; challenge?: string; userId?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !body) {
        throw new Error(body?.error?.message ?? `Sign in failed (${res.status})`);
      }
      if (body.mfaRequired && body.challenge) {
        setChallenge({ challenge: body.challenge, userId: body.userId ?? '' });
        return;
      }
      if (body.accessToken) {
        // Token mirrored into the HttpOnly session cookie by the API (#55);
        // sessionStorage copies support API calls + logout.
        sessionStorage.setItem('agora_access_token', body.accessToken);
        if (body.refreshToken) sessionStorage.setItem('agora_refresh_token', body.refreshToken);
        router.push('/account');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setWorking(false);
    }
  }

  if (challenge) {
    return <MfaStep challenge={challenge.challenge} onDone={() => router.push('/account')} />;
  }

  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Sign in</h1>
      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <button type="submit" disabled={working}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {working ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        <a href="/reset" className="font-medium text-brand-600 underline">Forgot password?</a>
        {' · '}
        <a href="/register" className="font-medium text-brand-600 underline">Create an account</a>
      </p>
    </main>
  );
}

function MfaStep({ challenge, onDone }: { challenge: string; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ challenge, code }),
      });
      const body = (await res.json().catch(() => null)) as { accessToken?: string; refreshToken?: string; error?: { message?: string } } | null;
      if (!res.ok || !body?.accessToken) throw new Error(body?.error?.message ?? 'MFA verification failed');
      sessionStorage.setItem('agora_access_token', body.accessToken);
      if (body.refreshToken) sessionStorage.setItem('agora_refresh_token', body.refreshToken);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Two-factor authentication</h1>
      {error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          6-digit code
          <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-widest shadow-sm focus:border-brand-500 focus:outline-none" />
        </label>
        <button type="submit" disabled={working}
          className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {working ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </main>
  );
}
