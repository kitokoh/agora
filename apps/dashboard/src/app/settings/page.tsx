import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Shop profile, subscription, and team management arrive with M1/M4.
      </p>
    </>
  );
}
