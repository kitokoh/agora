'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiBaseUrl } from '@/lib/api';

interface MeResponse {
  user: { id: string; email: string; roles: string[] };
  session: { id: string; lastUsedAt: string };
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; me: MeResponse }
  | { kind: 'error'; message: string };

export default function AccountPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const token = sessionStorage.getItem('agora_access_token');
      const res = await fetch(`${apiBaseUrl()}/v1/auth/me`, {
        // Session cookie authenticates the request (HttpOnly, #55); the
        // bearer is a fallback for non-browser SDK-style callers.
        credentials: 'include',
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Session expired — sign in again.' : `Request failed (${res.status})`);
      }
      const body = (await res.json()) as MeResponse;
      setState({ kind: 'ok', me: body });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut(): Promise<void> {
    setSigningOut(true);
    try {
      const refreshToken = sessionStorage.getItem('agora_refresh_token');
      await fetch(`${apiBaseUrl()}/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken ?? '' }),
      });
    } catch {
      // Best-effort: the cookie gets cleared server-side on any logout call.
    }
    sessionStorage.removeItem('agora_access_token');
    sessionStorage.removeItem('agora_refresh_token');
    router.push('/login');
  }

  if (state.kind === 'loading') {
    return (
      <main id="main" className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-slate-600">Loading your account…</p>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main id="main" className="mx-auto max-w-3xl px-6 py-12">
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}{' '}
          <a href="/login" className="font-medium underline">
            Go to sign in
          </a>
        </div>
      </main>
    );
  }

  const { me } = state;
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">My account</h1>
      <dl className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <dt className="text-sm font-medium text-slate-500">Email</dt>
          <dd className="mt-1 text-slate-900">{me.user.email}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Roles</dt>
          <dd className="mt-1 text-slate-900">{me.user.roles.join(', ') || 'buyer'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Last activity</dt>
          <dd className="mt-1 text-slate-900">{new Date(me.session.lastUsedAt).toLocaleString()}</dd>
        </div>
      </dl>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => void signOut()}
          disabled={signingOut}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        {me.user.roles.includes('seller') && (
          <a
            href={process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3001'}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Open seller dashboard
          </a>
        )}
      </div>
    </main>
  );
}
