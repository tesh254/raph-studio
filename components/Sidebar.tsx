'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, DEFAULT_API, getApiBase, setApiBase } from '@/lib/api';

type Conn = 'connecting' | 'ok' | 'bad';

const NAV: { href: string; label: string; icon: string; hint: string }[] = [
  { href: '/', label: 'Graph', icon: '◉', hint: 'explore the knowledge graph' },
  { href: '/memory/', label: 'Memory', icon: '✦', hint: 'durable knowledge & rules' },
  { href: '/handovers/', label: 'Handovers', icon: '⇄', hint: 'work transfers between agents' },
  { href: '/attribution/', label: 'Attribution', icon: '▤', hint: 'what agents touch & write' },
];

export default function Sidebar() {
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

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="logomark">rp</span>
        <span className="wordmark">raph <small>studio</small></span>
      </div>

      <nav className="side-nav">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`side-link ${active ? 'active' : ''}`}>
              <span className="side-icon" aria-hidden="true">{item.icon}</span>
              <span className="side-label">
                {item.label}
                <small>{item.hint}</small>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="side-foot">
        <label className="side-field">
          <span>api server</span>
          <input
            className="api-input"
            value={apiUrl}
            spellCheck={false}
            onChange={(e) => onApiChange(e.target.value.trim())}
            aria-label="raph studio API URL"
          />
        </label>
        <span className={`status ${conn === 'ok' ? 'ok' : conn === 'bad' ? 'bad' : ''}`}>
          <span className="pulse" />
          {conn === 'ok' ? 'live' : conn === 'bad' ? 'offline' : 'connecting'}
        </span>
      </div>
    </aside>
  );
}
