import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return <Section title="Products" blurb="Product CRUD and bulk import arrive with M2 (issue #11 in specs/002)." />;
}

function Section({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">{blurb}</p>
    </>
  );
}
