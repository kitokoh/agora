import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Admin · Agora', template: '%s · Agora admin' },
  description: 'Platform administration for Agora.',
};

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/shops', label: 'Shops' },
  { href: '/users', label: 'Users' },
  { href: '/moderation', label: 'Moderation' },
  { href: '/disputes', label: 'Disputes' },
  { href: '/finance', label: 'Finance' },
  { href: '/audit', label: 'Audit log' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-muted font-sans text-slate-900 antialiased">
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-900 text-slate-100">
            <div className="flex h-14 items-center border-b border-slate-700 px-4">
              <span className="text-sm font-bold text-white">Agora · Admin</span>
            </div>
            <nav aria-label="Admin navigation" className="p-2">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
              <span className="text-sm font-medium text-slate-700">Platform console</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                staff / admin only
              </span>
            </header>
            <main id="main" className="flex-1 px-6 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
