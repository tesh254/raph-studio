'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphEdge, GraphNode } from '@/lib/api';

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect: (id: string) => void;
  highlight?: Set<string>;
}

interface Sim {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  node: GraphNode;
}

const TYPE_COLOR: Record<string, string> = {
  func: '#7c83f5',
  type: '#4ade80',
  file: '#94a3b8',
  doc: '#f472b6',
  doc_chunk: '#fbbf24',
  file_chunk: '#fbbf24',
  markdown_chunk: '#fbbf24',
  memory: '#38bdf8',
};

function colorFor(type: string): string {
  return TYPE_COLOR[type] || '#64748b';
}

const WIDTH = 900;
const HEIGHT = 520;
// Cap rendered nodes so a large graph stays smooth; the count is surfaced.
const MAX_NODES = 260;

export default function GraphExplorer({ nodes, edges, onSelect, highlight }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [, force] = useState(0);
  const simRef = useRef<Sim[]>([]);
  const rafRef = useRef<number | null>(null);

  const { sims, links, truncated } = useMemo(() => {
    const limited = nodes.slice(0, MAX_NODES);
    const ids = new Set(limited.map((n) => n.id));
    const sims: Sim[] = limited.map((n, i) => {
      const angle = (i / Math.max(1, limited.length)) * Math.PI * 2;
      const radius = 120 + (i % 7) * 26;
      return {
        id: n.id,
        x: WIDTH / 2 + Math.cos(angle) * radius,
        y: HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        node: n,
      };
    });
    const links = edges.filter((e) => ids.has(e.source_id) && ids.has(e.target_id));
    return { sims, links, truncated: nodes.length > MAX_NODES };
  }, [nodes, edges]);

  simRef.current = sims;

  // Lightweight force simulation: repulsion + spring + centering, run for a
  // bounded number of frames so it settles and stops.
  useEffect(() => {
    const index = new Map(simRef.current.map((s, i) => [s.id, i]));
    let frame = 0;
    const step = () => {
      const arr = simRef.current;
      const n = arr.length;
      for (let i = 0; i < n; i++) {
        const a = arr[i];
        a.vx += (WIDTH / 2 - a.x) * 0.0015;
        a.vy += (HEIGHT / 2 - a.y) * 0.0015;
        for (let j = i + 1; j < n; j++) {
          const b = arr[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { d2 = 0.01; dx = Math.random(); dy = Math.random(); }
          const f = 900 / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      for (const l of links) {
        const ai = index.get(l.source_id);
        const bi = index.get(l.target_id);
        if (ai == null || bi == null) continue;
        const a = arr[ai]; const b = arr[bi];
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 90) * 0.02;
        const fx = (dx / d) * f; const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const s of arr) {
        s.vx *= 0.82; s.vy *= 0.82;
        s.x += s.vx; s.y += s.vy;
        s.x = Math.max(20, Math.min(WIDTH - 20, s.x));
        s.y = Math.max(20, Math.min(HEIGHT - 20, s.y));
      }
      force((v) => v + 1);
      frame++;
      if (frame < 220) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [links]);

  const pos = new Map(simRef.current.map((s) => [s.id, s]));

  return (
    <div className="graph-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        <g>
          {links.map((l, i) => {
            const a = pos.get(l.source_id);
            const b = pos.get(l.target_id);
            if (!a || !b) return null;
            return <line key={i} className="graph-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
        <g>
          {simRef.current.map((s) => {
            const dimmed = highlight && highlight.size > 0 && !highlight.has(s.id);
            const r = s.node.type === 'file' || s.node.type === 'doc' ? 7 : 5;
            return (
              <g key={s.id} opacity={dimmed ? 0.25 : 1}>
                <circle
                  className="graph-node"
                  cx={s.x}
                  cy={s.y}
                  r={r}
                  fill={colorFor(s.node.type)}
                  stroke="rgba(0,0,0,0.35)"
                  onClick={() => onSelect(s.id)}
                >
                  <title>{`${s.node.name} (${s.node.type})`}</title>
                </circle>
                {r >= 7 && <text className="node-label" x={s.x + 9} y={s.y + 3}>{trim(s.node.name)}</text>}
              </g>
            );
          })}
        </g>
      </svg>
      {truncated && (
        <div style={{ position: 'absolute', left: 12, bottom: 10, fontSize: 11.5, color: 'var(--muted)' }}>
          Showing {MAX_NODES} of {nodes.length} nodes
        </div>
      )}
    </div>
  );
}

function trim(name: string): string {
  return name.length > 22 ? name.slice(0, 22) + '…' : name;
}
