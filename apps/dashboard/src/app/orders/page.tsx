import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Fulfillment and order management arrive with M3–M4.
      </p>
    </>
  );
}
