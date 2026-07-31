'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

const MOBILE_QUERY = '(max-width: 720px)';

// AppShell owns the responsive frame: on desktop the sidebar is a fixed column;
// on narrow viewports it collapses into an off-canvas drawer opened by the
// header's menu button. Kept as a client component so the toggle has state; the
// page content (server-rendered) is passed straight through.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Track the drawer breakpoint. Crossing to desktop tears the drawer down, so a
  // resize from an open drawer can't leave the body scroll locked or focus
  // trapped in what is once again a static sidebar.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      setIsMobile(mq.matches);
      if (!mq.matches) setNavOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Close the drawer whenever navigation happens.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Drawer-open modal behavior: move focus into the drawer and trap Tab, close
  // on Escape, lock body scroll, and restore focus to the toggle on close. Only
  // the mobile menu button can open the drawer, so this never engages the
  // always-visible desktop sidebar. Background isolation (inert) is handled
  // declaratively below.
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

  // On mobile the closed drawer is inert — immediately non-focusable, so a Tab
  // during the slide-out can't reach a link that's animating off-screen. While
  // it's open, the page content behind it is inert so screen-reader browse mode
  // can't wander behind the drawer. On desktop neither applies: the sidebar is
  // the normal nav and the content is fully interactive.
  const drawerInert = isMobile && !navOpen;
  const contentInert = isMobile && navOpen;

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

      <Sidebar inert={drawerInert} />
      <main className="content" inert={contentInert || undefined}>{children}</main>
    </div>
  );
}
