'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { GraphEdge, GraphNode } from '@/lib/api';

let registered = false;
function ensureFcose() {
  if (!registered) {
    cytoscape.use(fcose);
    registered = true;
  }
}

export interface GraphHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  relayout: () => void;
  centerModel: (x: number, y: number) => void;
}

// A compact snapshot of the current layout + viewport, enough to draw a minimap
// without exposing the cytoscape instance.
export interface ViewportSnapshot {
  nodes: { id: string; x: number; y: number; color: string }[];
  view: { x1: number; y1: number; x2: number; y2: number };
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (id: string) => void;
  onClear?: () => void;
  highlight?: Set<string>;
  focusId?: string | null;
  hiddenTypes?: Set<string>;
  selectedId?: string | null;
  onViewport?: (v: ViewportSnapshot) => void;
}

// Cream-sketchbook palette per node type.
const COLOR: Record<string, string> = {
  file: '#1a3300', // forest ink — parents
  doc: '#f6d0ff', // blush
  func: '#ffe95c', // highlighter
  type: '#cb5521', // terracotta
  memory: '#a8e5e5', // teal
  const: '#d5f5c2', // mint
  var: '#e8d5b0', // sand
  doc_chunk: '#fcfaf5',
  file_chunk: '#fcfaf5',
  markdown_chunk: '#fcfaf5',
};
const LABEL_TEXT: Record<string, string> = {
  file: '#fcfaf5',
  type: '#fcfaf5',
};

// Cap rendered nodes so large graphs stay smooth.
export const MAX_NODES = 320;

function colorFor(t: string) { return COLOR[t] || '#b6b6b6'; }

function buildElements(nodes: GraphNode[], edges: GraphEdge[], hiddenTypes?: Set<string>) {
  const visible = hiddenTypes && hiddenTypes.size > 0
    ? nodes.filter((n) => !hiddenTypes.has(n.type))
    : nodes;

  const visibleIds = new Set(visible.map((n) => n.id));
  let limited: GraphNode[];
  if (visible.length <= MAX_NODES) {
    limited = visible;
  } else {
    // Build a CONNECTED, representative subgraph. Slicing the first N (the API
    // groups by type) or even picking the top-degree nodes yields an edgeless
    // set that fcose can only grid — high-degree files connect to their
    // members, not to each other. Instead, BFS out from the highest-degree
    // seeds so every added node arrives via a real edge, keeping structure.
    const adj = new Map<string, string[]>();
    const fullDegree = new Map<string, number>();
    for (const e of edges) {
      if (!visibleIds.has(e.source_id) || !visibleIds.has(e.target_id)) continue;
      (adj.get(e.source_id) ?? adj.set(e.source_id, []).get(e.source_id)!).push(e.target_id);
      (adj.get(e.target_id) ?? adj.set(e.target_id, []).get(e.target_id)!).push(e.source_id);
      fullDegree.set(e.source_id, (fullDegree.get(e.source_id) || 0) + 1);
      fullDegree.set(e.target_id, (fullDegree.get(e.target_id) || 0) + 1);
    }
    const seeds = [...visible].sort((a, b) => (fullDegree.get(b.id) || 0) - (fullDegree.get(a.id) || 0));
    const picked = new Set<string>();
    const queue: string[] = [];
    let si = 0;
    while (picked.size < MAX_NODES && (queue.length > 0 || si < seeds.length)) {
      if (queue.length === 0) {
        while (si < seeds.length && picked.has(seeds[si].id)) si++;
        if (si >= seeds.length) break;
        queue.push(seeds[si].id);
        si++;
      }
      const id = queue.shift()!;
      if (picked.has(id)) continue;
      picked.add(id);
      for (const nb of adj.get(id) ?? []) if (!picked.has(nb)) queue.push(nb);
    }
    limited = visible.filter((n) => picked.has(n.id));
  }

  const ids = new Set(limited.map((n) => n.id));
  const parents = new Set<string>();
  const degree = new Map<string, number>();
  for (const e of edges) {
    if (!ids.has(e.source_id) || !ids.has(e.target_id)) continue;
    parents.add(e.source_id); // a source has children → parent
    degree.set(e.source_id, (degree.get(e.source_id) || 0) + 1);
    degree.set(e.target_id, (degree.get(e.target_id) || 0) + 1);
  }
  const els: ElementDefinition[] = [];
  for (const n of limited) {
    const isParent = parents.has(n.id) || n.type === 'file' || n.type === 'doc';
    const deg = degree.get(n.id) || 0;
    const size = Math.max(14, Math.min(46, 16 + (isParent ? 10 : 0) + deg * 2));
    els.push({
      data: {
        id: n.id,
        label: isParent ? n.name.split('/').pop() || n.name : '',
        color: colorFor(n.type),
        textColor: LABEL_TEXT[n.type] || '#1a3300',
        size,
        isParent: isParent ? 1 : 0,
      },
    });
  }
  for (const e of edges) {
    if (!ids.has(e.source_id) || !ids.has(e.target_id)) continue;
    els.push({ data: { id: `${e.source_id}__${e.target_id}__${e.type}`, source: e.source_id, target: e.target_id } });
  }
  return els;
}

const GraphExplorer = forwardRef<GraphHandle, Props>(function GraphExplorer(
  { nodes, edges, onSelect, onClear, highlight, focusId, hiddenTypes, selectedId, onViewport },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const sigRef = useRef<string>('');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  const onViewportRef = useRef(onViewport);
  onViewportRef.current = onViewport;
  const focusRef = useRef<string | null>(null);
  focusRef.current = focusId ?? null;

  const runLayout = (cy: Core) => {
    if (cy.nodes().length === 0) return;
    // Re-measure first: the flex-sized stage may not have had its final height
    // when cytoscape initialized, which would collapse the layout into a
    // zero-area viewport. resize() picks up the real container dimensions.
    cy.resize();
    const layout = cy.layout({
      name: 'fcose',
      quality: 'default',
      animate: false,
      randomize: true,
      padding: 30,
      nodeRepulsion: () => 7000,
      idealEdgeLength: () => 70,
      gravity: 0.25,
    } as unknown as cytoscape.LayoutOptions);
    layout.one('layoutstop', () => {
      // A pending deep-link focus wins over the default parent framing. Kill
      // any viewport animation that targeted pre-layout positions first.
      const f = focusRef.current ? cy.getElementById(focusRef.current) : null;
      if (f && f.nonempty()) {
        cy.stop();
        f.addClass('hl');
        cy.zoom(1.2);
        cy.center(f);
        return;
      }
      // Frame the whole graph. (Fitting to parents alone zooms into a single
      // dominant hub when the sampled subgraph is one file's neighborhood.)
      cy.fit(undefined, 40);
    });
    layout.run();
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      const cy = cyRef.current;
      if (cy) cy.zoom({ level: cy.zoom() * 1.35, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    zoomOut: () => {
      const cy = cyRef.current;
      if (cy) cy.zoom({ level: cy.zoom() / 1.35, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    },
    fit: () => { cyRef.current?.fit(undefined, 40); },
    relayout: () => { if (cyRef.current) runLayout(cyRef.current); },
    centerModel: (x: number, y: number) => {
      const cy = cyRef.current;
      if (!cy) return;
      const z = cy.zoom();
      cy.pan({ x: cy.width() / 2 - x * z, y: cy.height() / 2 - y * z });
    },
  }), []);

  // Create the instance once.
  useEffect(() => {
    ensureFcose();
    if (!containerRef.current || cyRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      minZoom: 0.15,
      maxZoom: 3,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'border-color': '#1a3300',
            'border-width': 1,
            width: 'data(size)',
            height: 'data(size)',
            label: 'data(label)',
            color: 'data(textColor)',
            'font-family': 'var(--font-inter), system-ui, sans-serif',
            'font-size': 8,
            'font-weight': 600,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-max-width': '70px',
            'text-wrap': 'ellipsis',
          },
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#1a3300',
            opacity: 0.16,
            width: 1,
            'curve-style': 'bezier',
          },
        },
        { selector: 'node.dim', style: { opacity: 0.12 } },
        { selector: 'edge.dim', style: { opacity: 0.04 } },
        {
          selector: 'node.hl',
          style: { 'border-color': '#cb5521', 'border-width': 3, 'background-color': '#ffe95c' },
        },
        {
          selector: 'node.sel',
          style: { 'border-color': '#cb5521', 'border-width': 3 },
        },
        { selector: 'node.faded', style: { opacity: 0.25 } },
        { selector: 'edge.faded', style: { opacity: 0.05 } },
        { selector: 'edge.nbr', style: { opacity: 0.55, width: 1.5 } },
      ],
    });
    cy.on('tap', 'node', (evt) => onSelectRef.current(evt.target.id()));
    cy.on('tap', (evt) => {
      if (evt.target === cy) onClearRef.current?.();
    });

    // Emit a viewport snapshot for the minimap, coalesced to one per frame so
    // panning/zooming doesn't flood React with updates.
    let raf = 0;
    const emit = () => {
      raf = 0;
      const cb = onViewportRef.current;
      if (!cb) return;
      const ns = cy.nodes().map((n) => ({
        id: n.id(), x: n.position('x'), y: n.position('y'), color: n.data('color') as string,
      }));
      const e = cy.extent();
      cb({ nodes: ns, view: { x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2 } });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(emit); };
    cy.on('pan zoom', schedule);

    // The stage is flex/vh-sized and, in dev, the stylesheet can apply after
    // this mount effect — so the container may report 0×0 when cytoscape (and
    // the first layout) initialize, collapsing everything into a corner. A
    // ResizeObserver re-measures and, the first time real dimensions arrive,
    // re-runs the layout so the graph frames correctly.
    let sized = cy.width() > 0 && cy.height() > 0;
    const ro = new ResizeObserver(() => {
      if (containerRef.current!.clientHeight === 0 || containerRef.current!.clientWidth === 0) return;
      cy.resize();
      if (!sized) {
        sized = true;
        if (cy.nodes().length > 0) runLayout(cy);
      }
    });
    ro.observe(containerRef.current);

    cyRef.current = cy;
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Rebuild + re-layout only when the effective topology changes (data or
  // type filters) — not on every periodic data refresh.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const els = buildElements(nodes, edges, hiddenTypes);
    const nodeIds = els.filter((e) => !('source' in e.data)).map((e) => e.data.id);
    const sig = `${nodeIds.length}|${els.length}|${nodeIds.join(',')}`;
    if (sig === sigRef.current) return;
    sigRef.current = sig;

    cy.batch(() => {
      cy.elements().remove();
      cy.add(els);
    });
    runLayout(cy);
  }, [nodes, edges, hiddenTypes]);

  // Apply search highlight without re-laying out.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('dim hl');
      if (highlight && highlight.size > 0) {
        cy.nodes().forEach((n) => {
          if (highlight.has(n.id())) n.addClass('hl');
          else n.addClass('dim');
        });
        cy.edges().addClass('dim');
      }
    });
  }, [highlight]);

  // Emphasize the selected node's neighborhood; fade the rest.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass('sel faded nbr');
      if (!selectedId) return;
      const node = cy.getElementById(selectedId);
      if (node.empty()) return;
      const hood = node.closedNeighborhood();
      cy.elements().not(hood).addClass('faded');
      hood.edges().addClass('nbr');
      node.addClass('sel');
    });
  }, [selectedId, nodes]);

  // Center the focused node when focus changes after layout has settled.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !focusId) return;
    const node = cy.getElementById(focusId);
    if (node.empty()) return;
    node.addClass('hl');
    cy.stop();
    cy.zoom(Math.max(cy.zoom(), 1.2));
    cy.center(node);
  }, [focusId, nodes]);

  return <div className="graph-canvas" ref={containerRef} />;
});

export default GraphExplorer;
