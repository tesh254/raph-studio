'use client';

import { useEffect, useRef } from 'react';
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

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (id: string) => void;
  highlight?: Set<string>;
}

// Cream-sketchbook palette per node type.
const COLOR: Record<string, string> = {
  file: '#1a3300', // forest ink — parents
  doc: '#f6d0ff', // blush
  func: '#ffe95c', // highlighter
  type: '#cb5521', // terracotta
  memory: '#a8e5e5', // teal
  doc_chunk: '#fcfaf5',
  file_chunk: '#fcfaf5',
  markdown_chunk: '#fcfaf5',
};
const LABEL_TEXT: Record<string, string> = {
  file: '#fcfaf5',
  type: '#fcfaf5',
};

// Cap rendered nodes so large graphs stay smooth.
const MAX_NODES = 320;

function colorFor(t: string) { return COLOR[t] || '#b6b6b6'; }

function buildElements(nodes: GraphNode[], edges: GraphEdge[]) {
  const limited = nodes.slice(0, MAX_NODES);
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

export default function GraphExplorer({ nodes, edges, onSelect, highlight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const sigRef = useRef<string>('');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
      ],
    });
    cy.on('tap', 'node', (evt) => onSelectRef.current(evt.target.id()));
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  }, []);

  // Rebuild + re-layout only when the topology actually changes (prevents the
  // graph from re-shuffling on every periodic data refresh).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const sig = `${nodes.length}|${edges.length}|${nodes.slice(0, MAX_NODES).map((n) => n.id).join(',')}`;
    if (sig === sigRef.current) return;
    sigRef.current = sig;

    cy.batch(() => {
      cy.elements().remove();
      cy.add(buildElements(nodes, edges));
    });
    if (cy.nodes().length === 0) return;

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
      // Focus parent nodes first.
      const parents = cy.nodes('[isParent = 1]');
      if (parents.nonempty()) cy.fit(parents, 60);
      else cy.fit(undefined, 40);
    });
    layout.run();
  }, [nodes, edges]);

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

  return <div className="graph-canvas" ref={containerRef} />;
}
