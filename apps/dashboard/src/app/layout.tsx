import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Seller dashboard · Agora', template: '%s · Agora seller' },
  description: 'Manage your shop on Agora.',
};

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/products', label: 'Products' },
  { href: '/orders', label: 'Orders' },
  { href: '/payouts', label: 'Payouts' },
  { href: '/settings', label: 'Settings' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-muted font-sans text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
            <div className="flex h-14 items-center border-b border-slate-200 px-4">
              <span className="text-sm font-bold text-brand-600">Agora · Seller</span>
            </div>
            <nav aria-label="Seller navigation" className="p-2">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
              <span className="text-sm text-slate-500">Shop: <span className="font-medium text-slate-700">—</span></span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                draft shop
              </span>
            </header>
            <main id="main" className="flex-1 px-6 py-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
