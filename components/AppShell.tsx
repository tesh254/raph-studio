'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

// AppShell owns the responsive frame: on desktop the sidebar is a fixed column;
// on narrow viewports it collapses into an off-canvas drawer opened by the
// header's menu button. Kept as a client component so the toggle has state; the
// page content (server-rendered) is passed straight through.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the drawer whenever navigation happens.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // While the drawer is open, make it a proper modal surface for keyboard and
  // screen-reader users: move focus into it, trap Tab inside, close on Escape,
  // lock body scroll, and return focus to the toggle when it closes. Only the
  // mobile menu button can open the drawer, so none of this engages the
  // always-visible desktop sidebar.
  useEffect(() => {
    if (!navOpen) return;

    const drawer = document.querySelector<HTMLElement>('.sidebar');
    const focusables = drawer
      ? Array.from(
          drawer.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
      : [];
    focusables[0]?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        return;
      }
      if (e.key !== 'Tab' || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      toggleRef.current?.focus();
    };
  }, [navOpen]);

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <header className="topbar">
        <button
          ref={toggleRef}
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
