'use client';

import { useState, type FormEvent } from 'react';
import { apiBaseUrl } from '@/lib/api';

/**
 * MFA setup (audit #54): enroll (TOTP secret + otpauth URL) → enter 6-digit
 * code + current password → enable → show one-time recovery codes.
 * Authenticates via the HttpOnly session cookie (#55).
 */
interface EnrollResponse {
  secret: string;
  otpauthUrl: string;
}
interface EnableResponse {
  mfaEnabled: boolean;
  recoveryCodes: string[];
}

export default function MfaSettingsPage() {
  const [enrolled, setEnrolled] = useState<EnrollResponse | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function enroll(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/auth/mfa/enroll`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = (await res.json().catch(() => null)) as (EnrollResponse & { error?: { message?: string } }) | null;
      if (!res.ok || !body?.secret) throw new Error(body?.error?.message ?? `Enrollment failed (${res.status})`);
      setEnrolled(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setBusy(false);
    }
  }

  async function enable(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!enrolled) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/auth/mfa/enable`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, secret: enrolled.secret, code }),
      });
      const body = (await res.json().catch(() => null)) as (EnableResponse & { error?: { message?: string } }) | null;
      if (!res.ok || !body?.mfaEnabled) throw new Error(body?.error?.message ?? 'Verification failed');
      setRecoveryCodes(body.recoveryCodes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function copyCodes(): Promise<void> {
    if (!recoveryCodes) return;
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (recoveryCodes) {
    return (
      <div className="mx-auto max-w-xl" role="status">
        <h1 className="text-2xl font-bold text-slate-900">Two-factor authentication enabled</h1>
        <p className="mt-2 text-sm text-slate-600">
          Save these recovery codes somewhere safe. Each can be used once to sign in if you lose
          your authenticator. <strong>They will not be shown again.</strong>
        </p>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 font-mono text-sm text-amber-900">
          {recoveryCodes.join('\n')}
        </div>
        <button
          type="button"
          onClick={() => void copyCodes()}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? 'Copied ✓' : 'Copy codes'}
        </button>
      </div>
    );
  }

  if (!enrolled) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-slate-900">Two-factor authentication</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add a TOTP authenticator (Google Authenticator, 1Password, etc.) to protect your seller
          account. You&apos;ll need it on every sign-in.
        </p>
        {error && (
          <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void enroll()}
          disabled={busy}
          className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Generating…' : 'Set up authenticator'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Scan &amp; confirm</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          In your authenticator app, add a new account using this code:
          <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1 font-mono text-xs">
            {enrolled.otpauthUrl}
          </code>
        </li>
        <li>Enter the 6-digit code it shows, plus your password.</li>
      </ol>
      {error && (
        <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <form onSubmit={enable} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          6-digit code
          <input
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-widest shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Enabling…' : 'Enable two-factor auth'}
        </button>
      </form>
    </div>
  );
}
