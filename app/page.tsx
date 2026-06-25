'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  DEFAULT_API,
  getApiBase,
  setApiBase,
  type ActivityItem,
  type GraphNode,
  type GraphPayload,
  type Stats,
} from '@/lib/api';
import GraphExplorer from '@/components/GraphExplorer';

type Conn = 'connecting' | 'ok' | 'bad';

function badgeClass(type: string): string {
  const known = ['func', 'type', 'file', 'doc', 'doc_chunk', 'file_chunk', 'markdown_chunk', 'memory'];
  return 'badge ' + (known.includes(type) ? type : 'other');
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

export default function Page() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [conn, setConn] = useState<Conn>('connecting');
  const [stats, setStats] = useState<Stats | null>(null);
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [] });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GraphNode[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<(GraphNode & { content?: string }) | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setApiUrl(getApiBase());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, g] = await Promise.all([api.stats(), api.graph()]);
      setStats(s);
      setGraph(g);
      setConn('ok');
    } catch {
      setConn('bad');
    }
  }, []);

  // Initial + periodic full refresh.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh, apiUrl]);

  // Fast activity polling for a near-realtime feed of agent/sync changes.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const a = await api.activity();
        if (alive) setActivity(a.items);
      } catch {
        /* surfaced via the connection indicator */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(id); };
  }, [apiUrl]);

  const onApiChange = (url: string) => {
    setApiUrl(url);
    setApiBase(url);
    setConn('connecting');
  };

  const runSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setResults([]);
      setHighlight(new Set());
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.search(q, 15);
        setResults(r.matches || []);
        setHighlight(new Set((r.matches || []).map((m) => m.id)));
      } catch {
        setResults([]);
      }
    }, 220);
  };

  const openNode = async (id: string) => {
    try {
      const n = await api.node(id);
      setSelected(n);
    } catch {
      setSelected(null);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dotmark" />
          raph <small>studio</small>
        </div>
        <div className="spacer" />
        <input
          className="api-input"
          value={apiUrl}
          spellCheck={false}
          onChange={(e) => onApiChange(e.target.value.trim())}
          aria-label="raph studio API URL"
        />
        <div className={`status ${conn === 'ok' ? 'ok' : conn === 'bad' ? 'bad' : ''}`}>
          <span className="pulse" />
          {conn === 'ok' ? 'live' : conn === 'bad' ? 'offline' : 'connecting'}
        </div>
      </header>

      <div className="layout">
        <div className="col">
          <section className="panel">
            <div className="panel-head"><h2>Overview</h2></div>
            <div className="panel-body">
              {conn === 'bad' && (
                <div className="empty">
                  Can&apos;t reach the raph studio API at <code>{apiUrl}</code>.<br />
                  Run <code>raph studio</code> locally, then check the URL above.
                </div>
              )}
              <div className="stats-grid">
                <div className="stat"><div className="num">{stats?.nodes ?? '—'}</div><div className="label">nodes</div></div>
                <div className="stat"><div className="num">{stats?.edges ?? '—'}</div><div className="label">edges</div></div>
                <div className="stat"><div className="num">{stats?.workspaces ?? '—'}</div><div className="label">workspaces</div></div>
                <div className="stat"><div className="num">{stats ? Object.keys(stats.by_type).length : '—'}</div><div className="label">node types</div></div>
              </div>
              {stats && (
                <div className="chips">
                  {Object.entries(stats.by_type).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                    <span className="chip" key={t}><span className={badgeClass(t)}>{t}</span> <b>{c}</b></span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Graph explorer</h2></div>
            <GraphExplorer nodes={graph.nodes} edges={graph.edges} onSelect={openNode} highlight={highlight} />
            <div className="legend">
              {[['func', 'functions'], ['type', 'types'], ['file', 'files'], ['doc', 'docs'], ['memory', 'memory']].map(([t, l]) => (
                <span className="chip" key={t}><span className={badgeClass(t)}>{l}</span></span>
              ))}
            </div>
            {selected && (
              <div className="detail">
                <span className="close" onClick={() => setSelected(null)}>✕</span>
                <h3>{selected.name}</h3>
                <span className={badgeClass(selected.type)}>{selected.type}</span>{' '}
                <span className="rmeta">{selected.url}</span>
                {selected.content && <pre>{selected.content}</pre>}
              </div>
            )}
          </section>
        </div>

        <div className="col">
          <section className="panel">
            <div className="panel-head"><h2>Search</h2></div>
            <div className="panel-body">
              <div className="searchbar">
                <input
                  placeholder="Search code, docs, memory…"
                  value={query}
                  onChange={(e) => runSearch(e.target.value)}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                {results.map((r) => (
                  <div className="result-row" key={r.id} onClick={() => openNode(r.id)}>
                    <span className={badgeClass(r.type)}>{r.type}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="rname">{r.name}</div>
                      <div className="rmeta">{r.url || r.id}</div>
                    </div>
                  </div>
                ))}
                {query && results.length === 0 && <div className="empty">No matches</div>}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Live activity</h2>
              <div className="spacer" />
              <span className="rmeta">updates every 1.5s</span>
            </div>
            <div className="panel-body feed">
              {activity.length === 0 && <div className="empty">No recent activity</div>}
              {activity.map((a) => (
                <div className="feed-item" key={a.id + a.updated_at}>
                  <span className={badgeClass(a.type)}>{a.doc_type || a.type}</span>
                  <div style={{ minWidth: 0 }} onClick={() => openNode(a.id)}>
                    <div className="fname">{a.name}</div>
                    <div className="ftime">{relTime(a.updated_at)}{a.status ? ` · ${a.status}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
