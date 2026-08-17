'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { apiBaseUrl } from '@/lib/api';

/** Public catalog browsing (M2 — issue #66): search + category filter +
 * sort over GET /v1/products. Fully client-rendered against the live API. */
interface Product {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  basePriceMinor: string;
  media: { url: string; alt: string }[];
  shop: { id: string; slug: string; name: string } | null;
  categories: { id: string; slug: string; name: string }[];
}
interface Category {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
}
interface ListResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: ListResponse }
  | { kind: 'error'; message: string };

export default function BrowsePage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('newest');

  const load = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (category) params.set('category', category);
      if (sort) params.set('sort', sort);
      const res = await fetch(`${apiBaseUrl()}/v1/products?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Catalog request failed (${res.status})`);
      const data = (await res.json()) as ListResponse;
      setState({ kind: 'ok', data });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load products' });
    }
  }, [q, category, sort]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    void fetch(`${apiBaseUrl()}/v1/categories`)
      .then((r) => (r.ok ? (r.json() as Promise<Category[]>) : []))
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  function submitSearch(event: FormEvent): void {
    event.preventDefault();
    // q is in the load deps — state change re-triggers fetch.
    void load();
  }

  const money = (minor: string): string => `$${(Number(minor) / 100).toFixed(2)}`;

  return (
    <main id="main" className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Browse</h1>

      <form onSubmit={submitSearch} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Search
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ceramic vase, linen shirt…"
            className="mt-1 block w-64 rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="">All categories</option>
            {categories
              .filter((c) => c.parentId === null)
              .map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Search
        </button>
      </form>

      {state.kind === 'loading' && <p className="mt-6 text-sm text-slate-600">Loading products…</p>}

      {state.kind === 'error' && (
        <div role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {state.kind === 'ok' && (
        <>
          <p className="mt-4 text-sm text-slate-500">
            {state.data.total} product{state.data.total === 1 ? '' : 's'}
          </p>
          {state.data.items.length === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500">
              Nothing here yet — try a different search.
            </div>
          ) : (
            <ul aria-label="Products" className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {state.data.items.map((p) => (
                <li key={p.id}>
                  <a href={`/p/${p.slug}`} className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                    <div className="aspect-square bg-slate-100">
                      {p.media[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.media[0]!.url} alt={p.media[0]!.alt || p.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl text-slate-300">🛍️</div>
                      )}
                    </div>
                    <div className="p-3">
                      <h2 className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">{p.title}</h2>
                      <p className="truncate text-xs text-slate-500">{p.shop?.name ?? 'Independent seller'}</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{money(p.basePriceMinor)}</p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
