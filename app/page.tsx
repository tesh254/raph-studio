'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type GraphNode, type GraphPayload } from '@/lib/api';
import GraphExplorer, { MAX_NODES } from '@/components/GraphExplorer';

const KNOWN = ['func', 'type', 'file', 'doc', 'doc_chunk', 'file_chunk', 'markdown_chunk', 'memory'];
function badgeClass(type: string): string {
  return 'badge ' + (KNOWN.includes(type) ? type : 'other');
}

function GraphWorkspace() {
  const searchParams = useSearchParams();
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [] });
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GraphNode[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<(GraphNode & { content?: string }) | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinked = useRef(false);

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

  const openNode = useCallback(async (id: string) => {
    try { setSelected(await api.node(id)); } catch { setSelected(null); }
  }, []);

  // Deep link (/?node=<id>): select and center that node once the graph is up.
  useEffect(() => {
    const id = searchParams.get('node');
    if (!id || deepLinked.current || graph.nodes.length === 0) return;
    deepLinked.current = true;
    openNode(id);
    setFocusId(id);
  }, [searchParams, graph.nodes.length, openNode]);

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

  const shown = Math.min(graph.nodes.length, MAX_NODES);

  return (
    <div className="stage">
      <GraphExplorer
        nodes={graph.nodes}
        edges={graph.edges}
        onSelect={openNode}
        highlight={highlight}
        focusId={focusId}
      />

      <div className="panel panel-search">
        <input
          placeholder="Search the graph…"
          value={query}
          spellCheck={false}
          onChange={(e) => runSearch(e.target.value)}
          aria-label="Search the graph"
        />
        {query && (
          <div className="results">
            {results.map((r) => (
              <div className="result-row" key={r.id} onClick={() => { openNode(r.id); setFocusId(r.id); }}>
                <span className={badgeClass(r.type)}>{r.type}</span>
                <div style={{ minWidth: 0 }}>
                  <div><span className="rname">{r.name}</span></div>
                  <div className="rmeta">{r.url || r.id}</div>
                </div>
              </div>
            ))}
            {results.length === 0 && <div className="empty">No matches</div>}
          </div>
        )}
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

      <div className="stage-legend">
        {[['file', 'files'], ['doc', 'docs'], ['func', 'functions'], ['type', 'types'], ['memory', 'memory']].map(([t, l]) => (
          <span className="chip" key={t}><span className={badgeClass(t)}>{l}</span></span>
        ))}
      </div>

      <div className="stage-meta">
        {graph.nodes.length > MAX_NODES
          ? `showing ${shown} of ${graph.nodes.length} nodes`
          : `${graph.nodes.length} nodes · ${graph.edges.length} edges`}
      </div>

      {offline && (
        <div className="stage-offline">
          <div className="msg">
            Can&apos;t reach the raph studio API. Run <code>raph studio</code> locally and check the URL in the top bar.
          </div>
        </div>
      )}
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={null}>
      <GraphWorkspace />
    </Suspense>
  );
}
