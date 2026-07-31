'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

// AppShell owns the responsive frame: on desktop the sidebar is a fixed column;
// on narrow viewports it collapses into an off-canvas drawer opened by the
// header's menu button. Kept as a client component so the toggle has state; the
// page content (server-rendered) is passed straight through.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Close the drawer whenever navigation happens, and on Escape.
  useEffect(() => { setNavOpen(false); }, [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span aria-hidden="true">{navOpen ? '✕' : '☰'}</span>
        </button>
        <span className="topbar-brand">raph <small>studio</small></span>
      </header>

      {navOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      )}

      <Sidebar />
      <main className="content">{children}</main>
    </div>
  );
}
