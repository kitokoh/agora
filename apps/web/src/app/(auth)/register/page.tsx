'use client';

import { apiBaseUrl } from '@/components/auth/auth-form';
import { AuthForm } from '@/components/auth/auth-form';


export default function RegisterPage() {
  return (
    <main id="main" className="mx-auto max-w-md px-6 py-16">
      <AuthForm
        title="Create your account"
        submitLabel="Sign up"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password (min 8 chars, letter + number)', type: 'password', autoComplete: 'new-password' },
        ]}
        onSubmit={async (values) => {
          const res = await fetch(`${apiBaseUrl()}/v1/auth/register`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: values.email, password: values.password }),
          });
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
          if (!res.ok) throw new Error(body?.error?.message ?? `Registration failed (${res.status})`);
          // Registration succeeded — tell the user to check their inbox.
          window.location.href = '/verify?sent=1';
        }}
      />
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <a href="/login" className="font-medium text-brand-600 underline">
          Sign in
        </a>
      </p>
    </main>
  );
}
