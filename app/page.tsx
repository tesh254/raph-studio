'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type ActivityItem,
  type Analytics,
  type Stats,
} from '@/lib/api';

const KNOWN = ['func', 'type', 'file', 'doc', 'doc_chunk', 'file_chunk', 'markdown_chunk', 'memory'];
function badgeClass(type: string): string {
  return 'badge ' + (KNOWN.includes(type) ? type : 'other');
}

function relTime(iso?: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.stats(), api.analytics()]);
      setStats(s);
      setAnalytics(a);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const a = await api.activity();
        if (alive) setActivity(a.items);
      } catch { /* surfaced by the nav status */ }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const topNodes = analytics?.top_nodes ?? [];
  const maxCount = topNodes.reduce((m, n) => Math.max(m, n.count), 1);
  const searches = analytics?.top_searches ?? [];
  const maxSearch = searches.reduce((m, s) => Math.max(m, s.count), 1);

  return (
    <>
      <div className="eyebrow">★ analytics</div>
      <h1 className="hero-title">
        What your agents <span className="mark">touch</span> most.
      </h1>

      {offline && (
        <div className="card blush" style={{ marginBottom: 20 }}>
          Can&apos;t reach the raph studio API. Run <code>raph studio</code> locally and check the URL in the nav.
        </div>
      )}

      <div className="layout">
        <div className="col">
          <section className="card">
            <div className="card-head"><h2>Access</h2></div>
            <div className="stats-grid">
              <div className="stat"><div className="num">{analytics?.total_events ?? '—'}</div><div className="label">total accesses</div></div>
              <div className="stat"><div className="num">{analytics?.last_24h ?? '—'}</div><div className="label">last 24h</div></div>
              <div className="stat"><div className="num">{analytics?.unique_nodes ?? '—'}</div><div className="label">nodes touched</div></div>
              <div className="stat"><div className="num">{analytics?.searches ?? '—'}</div><div className="label">searches</div></div>
            </div>
            {analytics?.by_kind && analytics.by_kind.length > 0 && (
              <div className="chips">
                {analytics.by_kind.map((k) => (
                  <span className="chip" key={k.kind}>{k.kind} <b>{k.count}</b></span>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-head"><h2>Most accessed</h2></div>
            {topNodes.length === 0 && <div className="empty">No access recorded yet — open nodes or search to populate this.</div>}
            {topNodes.map((n, i) => (
              <div className="access-row" key={n.node_id}>
                <span className="arank">{i + 1}</span>
                <div className="aname">
                  <div className="t">{n.name || n.node_id}</div>
                  <div className="bar" style={{ width: `${Math.round((n.count / maxCount) * 100)}%` }} />
                </div>
                <span className={badgeClass(n.type)}>{n.type || '—'}</span>
                <span className="acount">{n.count}</span>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-head"><h2>Graph</h2></div>
            <div className="stats-grid">
              <div className="stat"><div className="num">{stats?.nodes ?? '—'}</div><div className="label">nodes</div></div>
              <div className="stat"><div className="num">{stats?.edges ?? '—'}</div><div className="label">edges</div></div>
              <div className="stat"><div className="num">{stats?.workspaces ?? '—'}</div><div className="label">workspaces</div></div>
              <div className="stat"><div className="num">{stats ? Object.keys(stats.by_type).length : '—'}</div><div className="label">types</div></div>
            </div>
            {stats && (
              <div className="chips">
                {Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                  <span className="chip" key={t}><span className={badgeClass(t)}>{t}</span> <b>{c}</b></span>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="col">
          <section className="card teal">
            <div className="card-head"><h2>Top searches</h2></div>
            {searches.length === 0 && <div className="empty">No searches yet</div>}
            {searches.map((s) => (
              <div className="access-row" key={s.query}>
                <div className="aname">
                  <div className="t">{s.query}</div>
                  <div className="bar y" style={{ width: `${Math.round((s.count / maxSearch) * 100)}%` }} />
                </div>
                <span className="acount">{s.count}</span>
              </div>
            ))}
          </section>

          <section className="card mint">
            <div className="card-head">
              <h2>Live activity</h2>
              <div className="spacer" />
              <span className="card-note">every 1.5s</span>
            </div>
            <div className="feed">
              {activity.length === 0 && <div className="empty">No recent activity</div>}
              {activity.map((a) => (
                <div className="feed-item" key={a.id + a.updated_at}>
                  <span className={badgeClass(a.type)}>{a.doc_type || a.type}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="fname">{a.name}</div>
                    <div className="ftime">{relTime(a.updated_at)}{a.status ? ` · ${a.status}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
