import { HealthCheck } from '@/components/health-check';

export default function HomePage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <header className="mb-10">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-600">
          Agora
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          The marketplace for boutiques
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Shop independent sellers, support small businesses, and find things you
          won&apos;t see anywhere else.
        </p>
      </header>

      <div className="mt-6 flex gap-3">
        <a
          href="/browse"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Browse products
        </a>
        <a
          href="/login"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign in
        </a>
      </div>

      <section aria-label="Platform status" className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Platform status</h2>
        <HealthCheck />
      </section>

      <nav aria-label="Primary" className="mt-10 flex gap-4">
        <a
          href="/browse"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Browse shops
        </a>
        <a
          href="/login"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400"
        >
          Sign in
        </a>
      </nav>
    </main>
  );
}
