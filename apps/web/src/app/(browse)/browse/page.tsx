import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Browse' };

export default function BrowsePage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Browse shops</h1>
      <p className="mt-3 text-slate-600">
        Shop listings arrive with the catalog milestone (M2). Follow{' '}
        <a className="text-brand-600 underline" href="https://github.com/kitokoh/agora">
          the roadmap
        </a>
        .
      </p>
    </main>
  );
}
