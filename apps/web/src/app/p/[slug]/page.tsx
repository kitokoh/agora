'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiBaseUrl } from '@/lib/api';

/** Public product detail (M2 — issue #66): GET /v1/products/:slug. */
interface Variant {
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  priceMinor: string;
  compareAtMinor: string | null;
  stock: number;
}
interface Product {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  basePriceMinor: string;
  status: string;
  currency: string;
  media: { url: string; alt: string }[];
  attributes: Record<string, string>;
  shop: { id: string; slug: string; name: string } | null;
  categories: { id: string; slug: string; name: string }[];
  variants: Variant[];
}

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; product: Product }
  | { kind: 'error'; message: string };

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [selected, setSelected] = useState<Variant | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${apiBaseUrl()}/v1/products/${params.slug}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'This product is not available.' : `Request failed (${res.status})`);
        }
        const product = (await res.json()) as Product;
        setState({ kind: 'ok', product });
        setSelected(product.variants[0] ?? null);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Could not load product' });
      }
    })();
    return () => controller.abort();
  }, [params.slug]);

  const money = (minor: string): string => `$${(Number(minor) / 100).toFixed(2)}`;

  if (state.kind === 'loading') {
    return (
      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-slate-600">Loading product…</p>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}{' '}
          <a href="/browse" className="font-medium underline">
            Back to browse
          </a>
        </div>
      </main>
    );
  }

  const { product } = state;
  const image = product.media[imageIndex] ?? product.media[0];
  const activePrice = selected?.priceMinor ?? product.basePriceMinor;

  return (
    <main id="main" className="mx-auto max-w-5xl px-6 py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
        <a href="/browse" className="hover:text-brand-700">
          Browse
        </a>
        {product.categories[0] && (
          <>
            {' / '}
            <a href={`/browse?category=${product.categories[0].slug}`} className="hover:text-brand-700">
              {product.categories[0].name}
            </a>
          </>
        )}
        {' / '}
        <span className="text-slate-900">{product.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.url} alt={image.alt || product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl text-slate-300">🛍️</div>
            )}
          </div>
          {product.media.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.media.map((m, i) => (
                <button
                  key={m.url}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`h-16 w-16 overflow-hidden rounded-md border ${i === imageIndex ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200'}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.alt || `Image ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">{product.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            by {product.shop ? <a href={`/browse?shop=${product.shop.slug}`} className="hover:text-brand-700">{product.shop.name}</a> : 'Independent seller'}
          </p>

          <p className="mt-4 text-2xl font-bold text-slate-900">{money(activePrice)}</p>
          {selected?.compareAtMinor && (
            <p className="text-sm text-slate-400 line-through">{money(selected.compareAtMinor)}</p>
          )}

          {product.variants.length > 1 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-700">Options</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelected(v)}
                    aria-pressed={selected?.id === v.id}
                    disabled={v.stock === 0}
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      selected?.id === v.id
                        ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
                        : v.stock === 0
                          ? 'border-slate-200 text-slate-300'
                          : 'border-slate-300 text-slate-700 hover:border-brand-400'
                    }`}
                  >
                    {Object.values(v.optionValues).join(' / ') || v.sku}
                    {v.stock === 0 ? ' (sold out)' : ''}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {product.description && <p className="mt-5 whitespace-pre-line text-slate-700">{product.description}</p>}

          {Object.keys(product.attributes).length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 p-4 text-sm">
              {Object.entries(product.attributes).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-slate-500">{key}</dt>
                  <dd className="font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </main>
  );
}
