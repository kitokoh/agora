'use client';

import { useEffect, useState } from 'react';
import { apiBaseUrl } from '@/lib/api';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; service: string; uptimeSeconds: number }
  | { kind: 'unreachable'; message: string };

/**
 * Demonstrates the typed SDK against the live API. Fails gracefully when
 * the API is not running locally (no error boundary trip).
 */
export function HealthCheck() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function check(): Promise<void> {
      try {
        const res = await fetch(`${apiBaseUrl()}/healthz`, { next: undefined, cache: 'no-store' });
        if (!res.ok) throw new Error(`health check failed with status ${res.status}`);
        const body = (await res.json()) as { status: string; service: string; uptimeSeconds: number };
        if (cancelled) return;
        if (body.status === 'ok') {
          setState({ kind: 'ok', service: body.service, uptimeSeconds: body.uptimeSeconds });
        } else {
          setState({ kind: 'unreachable', message: `unexpected status ${body.status}` });
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'unreachable',
          message: err instanceof Error ? err.message : 'unknown error',
        });
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return <p className="text-sm text-slate-500">Checking API health…</p>;
  }
  if (state.kind === 'ok') {
    return (
      <p className="text-sm text-emerald-700">
        <span className="font-semibold">{state.service}</span> is up (uptime{' '}
        {state.uptimeSeconds}s)
      </p>
    );
  }
  return (
    <p className="text-sm text-amber-700">
      API unreachable — start it with <code className="rounded bg-slate-100 px-1">pnpm dev</code>.
      ({state.message})
    </p>
  );
}
