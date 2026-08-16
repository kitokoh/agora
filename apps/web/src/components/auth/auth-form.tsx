'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { apiBaseUrl } from '@/lib/api';

interface AuthFormProps {
  title: string;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  fields: { name: string; label: string; type?: string; autoComplete?: string; required?: boolean }[];
  children?: ReactNode;
}

/**
 * Shared auth form — renders labeled inputs, submits JSON to the API,
 * and surfaces ApiError-shaped responses inline (a11y: error summary).
 */
export function AuthForm({ title, submitLabel, onSubmit, fields, children }: AuthFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {error && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {fields.map((field) => (
        <label key={field.name} className="block text-sm font-medium text-slate-700">
          {field.label}
          <input
            type={field.type ?? 'text'}
            name={field.name}
            required={field.required ?? true}
            autoComplete={field.autoComplete}
            value={values[field.name] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? 'Please wait…' : submitLabel}
      </button>
      {children}
    </form>
  );
}

export { apiBaseUrl };
