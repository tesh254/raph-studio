'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, DEFAULT_API, getApiBase, setApiBase } from '@/lib/api';

type Conn = 'connecting' | 'ok' | 'bad';

export default function Nav() {
  const pathname = usePathname();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [conn, setConn] = useState<Conn>('connecting');

  useEffect(() => { setApiUrl(getApiBase()); }, []);

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try { await api.stats(); if (alive) setConn('ok'); }
      catch { if (alive) setConn('bad'); }
    };
    ping();
    const id = setInterval(ping, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [apiUrl]);

  const onApiChange = (url: string) => {
    setApiUrl(url);
    setApiBase(url);
    setConn('connecting');
  };

  const links: [string, string][] = [
    ['/', 'Analytics'],
    ['/graph/', 'Graph'],
  ];

  return (
    <nav className="nav">
      <div className="brand">
        <span className="logomark">rp</span>
        <span className="wordmark">raph <small>studio</small></span>
      </div>
      <div className="nav-links">
        {links.map(([href, label]) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`nav-link ${active ? 'active' : ''}`}>
              {label}
            </Link>
          );
        })}
      </div>
      <div className="spacer" />
      <input
        className="api-input"
        value={apiUrl}
        spellCheck={false}
        onChange={(e) => onApiChange(e.target.value.trim())}
        aria-label="raph studio API URL"
      />
      <span className={`status ${conn === 'ok' ? 'ok' : conn === 'bad' ? 'bad' : ''}`}>
        <span className="pulse" />
        {conn === 'ok' ? 'live' : conn === 'bad' ? 'offline' : 'connecting'}
      </span>
    </nav>
  );
}
