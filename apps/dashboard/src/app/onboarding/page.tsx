'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiBaseUrl } from '@/lib/api';

/**
 * Seller onboarding wizard (audit #54): profile → shop → KYC → submit.
 * Resumes from GET /v1/onboarding/status; every call authenticates via the
 * HttpOnly session cookie (#55) — no client-side token needed.
 */
interface Status {
  step: 'profile' | 'shop' | 'kyc' | 'done';
  profileComplete: boolean;
  shop: { id: string; name: string; slug: string; status: string } | null;
  kyc: { state: string } | null;
}

const STEPS = ['profile', 'shop', 'kyc', 'submit'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ shopStatus: string } | null>(null);

  // form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [bio, setBio] = useState('');
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'company'>('individual');
  const [docsRefs, setDocsRefs] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl()}/v1/onboarding/status`, { credentials: 'include' });
      if (res.status === 401) {
        setError('Your session expired — sign in again.');
        return;
      }
      if (!res.ok) throw new Error(`Status check failed (${res.status})`);
      const body = (await res.json()) as Status;
      setStatus(body);
      setStep(body.step === 'done' ? 'submit' : body.step);
      if (body.profileComplete) {
        setFullName('✓ saved'); // hint values are server-side; fields refresh on edit
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
    return data;
  }

  async function submitProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/v1/onboarding/profile', { fullName, phone: phone || undefined, country: country || undefined, bio: bio || undefined });
      setStep('shop');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setBusy(false);
    }
  }

  async function submitShop(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/v1/onboarding/shop', { name: shopName, slug });
      setStep('kyc');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shop');
    } finally {
      setBusy(false);
    }
  }

  async function submitKyc(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost('/v1/onboarding/kyc', {
        entityType,
        docsRefs: docsRefs.split(',').map((d) => d.trim()).filter(Boolean),
      });
      setStep('submit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save KYC');
    } finally {
      setBusy(false);
    }
  }

  async function submitAll(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ shopStatus: string }>('/v1/onboarding/submit', {});
      setDone(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  if (error && step === null) {
    return (
      <div role="alert" className="max-w-xl rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}{' '}
        <a href="http://localhost:3000/login" className="font-medium underline">
          Sign in
        </a>
      </div>
    );
  }

  if (step === null) {
    return <p className="text-sm text-slate-600">Loading your onboarding state…</p>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Seller onboarding</h1>

      {/* Step indicator */}
      <ol aria-label="Onboarding progress" className="mt-4 flex gap-2">
        {STEPS.map((s) => {
          const idx = STEPS.indexOf(s);
          const currentIdx = STEPS.indexOf(step);
          const state = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'todo';
          return (
            <li
              key={s}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                state === 'done'
                  ? 'bg-emerald-100 text-emerald-800'
                  : state === 'current'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {state === 'done' ? '✓ ' : ''}
              {s}
            </li>
          );
        })}
      </ol>

      {error && (
        <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {done ? (
        <div role="status" className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Submitted!</h2>
          <p className="mt-1 text-sm text-emerald-800">
            Your shop is <strong>{done.shopStatus}</strong>.
            {done.shopStatus === 'active'
              ? ' You can start listing products.'
              : ' Our team reviews applications — check back soon.'}
          </p>
        </div>
      ) : (
        <form onSubmit={step === 'profile' ? submitProfile : step === 'shop' ? submitShop : step === 'kyc' ? submitKyc : submitAll} className="mt-6 space-y-4">
          {step === 'profile' && (
            <>
              <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Ada Lovelace" required />
              <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="+33 1 23 45 67 89" />
              <Field label="Country (ISO 2-letter, optional)" value={country} onChange={setCountry} maxLength={2} placeholder="FR" />
              <label className="block text-sm font-medium text-slate-700">
                Bio (optional)
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
                />
              </label>
            </>
          )}

          {step === 'shop' && (
            <>
              <Field label="Shop name" value={shopName} onChange={setShopName} placeholder="Maison Étoile" required />
              <Field label="Slug (lowercase, hyphens)" value={slug} onChange={setSlug} placeholder="maison-etoile" required pattern="[a-z0-9-]{3,63}" />
              {status?.shop && (
                <p className="text-sm text-slate-500">
                  Current shop: {status.shop.name} ({status.shop.status})
                </p>
              )}
            </>
          )}

          {step === 'kyc' && (
            <>
              <label className="block text-sm font-medium text-slate-700">
                Entity type
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value as 'individual' | 'company')}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </label>
              <Field label="Document references (comma-separated, optional)" value={docsRefs} onChange={setDocsRefs} placeholder="passport-1234, utility-bill-2026" />
            </>
          )}

          {step === 'submit' && (
            <p className="text-sm text-slate-600">
              Review complete — submitting starts the verification process{status?.kyc?.state ? ` (KYC state: ${status.kyc.state})` : ''}.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : step === 'submit' ? 'Submit for review' : 'Continue'}
          </button>
        </form>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  pattern?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        maxLength={props.maxLength}
        pattern={props.pattern}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
      />
    </label>
  );
}
