'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type GraphNode, type GraphPayload } from '@/lib/api';
import GraphExplorer from '@/components/GraphExplorer';

const KNOWN = ['func', 'type', 'file', 'doc', 'doc_chunk', 'file_chunk', 'markdown_chunk', 'memory'];
function badgeClass(type: string): string {
  return 'badge ' + (KNOWN.includes(type) ? type : 'other');
}

export default function GraphPage() {
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [] });
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GraphNode[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<(GraphNode & { content?: string }) | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setGraph(await api.graph());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const runSearch = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); setHighlight(new Set()); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.search(q, 15);
        setResults(r.matches || []);
        setHighlight(new Set((r.matches || []).map((m) => m.id)));
      } catch { setResults([]); }
    }, 220);
  };

  const openNode = async (id: string) => {
    try { setSelected(await api.node(id)); } catch { setSelected(null); }
  };

  return (
    <>
      <div className="eyebrow">★ graph explorer</div>
      <h1 className="hero-title">
        Explore the <span className="mark">graph</span>.
      </h1>

      {offline && (
        <div className="card blush" style={{ marginBottom: 20 }}>
          Can&apos;t reach the raph studio API. Run <code>raph studio</code> locally and check the URL in the nav.
        </div>
      )}

      <div className="layout">
        <div className="col">
          <section className="card">
            <div className="card-head">
              <h2>Graph</h2>
              <div className="spacer" />
              <span className="card-note">parents centered · click a node</span>
            </div>
            <div className="graph-wrap">
              <GraphExplorer nodes={graph.nodes} edges={graph.edges} onSelect={openNode} highlight={highlight} />
              {selected && (
                <div className="detail">
                  <span className="close" onClick={() => setSelected(null)}>✕</span>
                  <h3>{selected.name}</h3>
                  <span className={badgeClass(selected.type)}>{selected.type}</span>{' '}
                  <span className="rmeta">{selected.url}</span>
                  {selected.content && <pre>{selected.content}</pre>}
                </div>
              )}
            </div>
            <div className="legend">
              {[['file', 'files'], ['doc', 'docs'], ['func', 'functions'], ['type', 'types'], ['memory', 'memory']].map(([t, l]) => (
                <span className="chip" key={t}><span className={badgeClass(t)}>{l}</span></span>
              ))}
            </div>
          </section>
        </div>

        <div className="col">
          <section className="card">
            <div className="card-head"><h2>Search</h2></div>
            <div className="searchbar">
              <input placeholder="Search to highlight in the graph…" value={query} onChange={(e) => runSearch(e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              {results.map((r) => (
                <div className="result-row" key={r.id} onClick={() => openNode(r.id)}>
                  <span className={badgeClass(r.type)}>{r.type}</span>
                  <div style={{ minWidth: 0 }}>
                    <div><span className="rname">{r.name}</span></div>
                    <div className="rmeta">{r.url || r.id}</div>
                  </div>
                </div>
              ))}
              {query && results.length === 0 && <div className="empty">No matches</div>}
              {!query && <div className="empty">Search to highlight matching nodes in the graph.</div>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
