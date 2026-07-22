'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, type GraphNode, type GraphPayload } from '@/lib/api';
import GraphExplorer, { MAX_NODES, type GraphHandle, type ViewportSnapshot } from '@/components/GraphExplorer';
import Minimap from '@/components/Minimap';

const KNOWN = ['func', 'type', 'file', 'doc', 'doc_chunk', 'file_chunk', 'markdown_chunk', 'memory', 'const', 'var'];
function badgeClass(type: string): string {
  return 'badge ' + (KNOWN.includes(type) ? type : 'other');
}

interface Crumb { id: string; name: string; type: string; }

function GraphWorkspace() {
  const searchParams = useSearchParams();
  const [graph, setGraph] = useState<GraphPayload>({ nodes: [], edges: [] });
  const [offline, setOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GraphNode[]>([]);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<(GraphNode & { content?: string }) | null>(null);
  const [neighbors, setNeighbors] = useState<GraphNode[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [viewport, setViewport] = useState<ViewportSnapshot | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinked = useRef(false);
  const graphRef = useRef<GraphHandle>(null);

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

  const pushCrumb = useCallback((c: Crumb) => {
    setCrumbs((prev) => {
      if (prev[prev.length - 1]?.id === c.id) return prev;
      const existing = prev.findIndex((p) => p.id === c.id);
      if (existing >= 0) return prev.slice(0, existing + 1);
      return [...prev, c].slice(-8);
    });
  }, []);

  // Select a node: load its detail + neighbors, and optionally recenter the
  // canvas on it and record it in the breadcrumb trail.
  const selectNode = useCallback(async (id: string, opts?: { focus?: boolean }) => {
    if (opts?.focus) setFocusId(id);
    try {
      const node = await api.node(id);
      setSelected(node);
      pushCrumb({ id, name: node.name, type: node.type });
    } catch {
      setSelected(null);
    }
    try {
      const nb = await api.neighbors(id);
      setNeighbors((nb.nodes || []).filter((n) => n.id !== id));
    } catch {
      setNeighbors([]);
    }
  }, [pushCrumb]);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setNeighbors([]);
  }, []);

  // Deep link (/?node=<id>): select and center that node once the graph is up.
  useEffect(() => {
    const id = searchParams.get('node');
    if (!id || deepLinked.current || graph.nodes.length === 0) return;
    deepLinked.current = true;
    selectNode(id, { focus: true });
  }, [searchParams, graph.nodes.length, selectNode]);

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

  const toggleType = (t: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  // Type toggles, ordered by frequency, drawn from what the graph actually holds.
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph.nodes) m.set(n.type, (m.get(n.type) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [graph.nodes]);

  const shown = Math.min(graph.nodes.length, MAX_NODES);

  return (
    <div className="stage">
      <GraphExplorer
        ref={graphRef}
        nodes={graph.nodes}
        edges={graph.edges}
        onSelect={(id) => selectNode(id)}
        onClear={clearSelection}
        highlight={highlight}
        focusId={focusId}
        hiddenTypes={hiddenTypes}
        selectedId={selected?.id ?? null}
        onViewport={setViewport}
      />

      {/* Search + type filters */}
      <div className="panel panel-search">
        <input
          placeholder="Search the graph…"
          value={query}
          spellCheck={false}
          onChange={(e) => runSearch(e.target.value)}
          aria-label="Search the graph"
        />
        {query ? (
          <div className="results">
            {results.map((r) => (
              <div className="result-row" key={r.id} onClick={() => selectNode(r.id, { focus: true })}>
                <span className={badgeClass(r.type)}>{r.type}</span>
                <div style={{ minWidth: 0 }}>
                  <div><span className="rname">{r.name}</span></div>
                  <div className="rmeta">{r.url || r.id}</div>
                </div>
              </div>
            ))}
            {results.length === 0 && <div className="empty">No matches</div>}
          </div>
        ) : (
          <div className="filters">
            {typeCounts.map(([t, c]) => (
              <button
                key={t}
                className={`chip filter ${hiddenTypes.has(t) ? 'off' : ''}`}
                onClick={() => toggleType(t)}
                aria-pressed={!hiddenTypes.has(t)}
                title={hiddenTypes.has(t) ? `Show ${t}` : `Hide ${t}`}
              >
                <span className={badgeClass(t)}>{t}</span> <b>{c}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Breadcrumb trail of visited nodes */}
      {crumbs.length > 0 && (
        <div className="stage-crumbs">
          {crumbs.map((c, i) => (
            <span key={c.id + i} className="crumb-wrap">
              {i > 0 && <span className="crumb-sep">›</span>}
              <button
                className={`crumb ${i === crumbs.length - 1 ? 'here' : ''}`}
                onClick={() => selectNode(c.id, { focus: true })}
                title={c.name}
              >
                {c.name.split('/').pop() || c.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Node inspector */}
      {selected && (
        <div className="detail">
          <span className="close" onClick={clearSelection}>✕</span>
          <h3>{selected.name}</h3>
          <div className="detail-meta">
            <span className={badgeClass(selected.type)}>{selected.type}</span>
            {selected.url && <span className="rmeta">{selected.url}</span>}
          </div>
          <div className="detail-actions">
            <button className="ctrl-btn wide" onClick={() => setFocusId(selected.id)}>Focus</button>
          </div>
          {selected.content && <pre>{selected.content}</pre>}
          <div className="nbr-head">
            Neighbors <b>{neighbors.length}</b>
          </div>
          {neighbors.length === 0 ? (
            <div className="empty small">No linked nodes</div>
          ) : (
            <div className="nbr-list">
              {neighbors.map((n) => (
                <div className="nbr-row" key={n.id} onClick={() => selectNode(n.id, { focus: true })}>
                  <span className={badgeClass(n.type)}>{n.type}</span>
                  <span className="nbr-name">{n.name.split('/').pop() || n.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Canvas controls */}
      <div className="stage-controls">
        <button className="ctrl-btn" title="Zoom in" onClick={() => graphRef.current?.zoomIn()}>+</button>
        <button className="ctrl-btn" title="Zoom out" onClick={() => graphRef.current?.zoomOut()}>−</button>
        <button className="ctrl-btn" title="Fit to view" onClick={() => graphRef.current?.fit()}>⤢</button>
        <button className="ctrl-btn" title="Re-run layout" onClick={() => graphRef.current?.relayout()}>↻</button>
      </div>

      <Minimap snapshot={viewport} onRecenter={(x, y) => graphRef.current?.centerModel(x, y)} />

      <div className="stage-meta">
        {graph.nodes.length > MAX_NODES
          ? `showing ${shown} of ${graph.nodes.length} nodes`
          : `${graph.nodes.length} nodes · ${graph.edges.length} edges`}
      </div>

      {offline && (
        <div className="stage-offline">
          <div className="msg">
            Can&apos;t reach the raph studio API. Run <code>raph studio</code> locally and check the URL in the sidebar.
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
