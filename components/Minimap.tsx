'use client';

import { useMemo, useRef } from 'react';
import type { ViewportSnapshot } from '@/components/GraphExplorer';

const W = 168;
const H = 116;
const PAD = 8;

interface Props {
  snapshot: ViewportSnapshot | null;
  onRecenter: (modelX: number, modelY: number) => void;
}

// A lightweight overview of the whole layout with a draggable viewport frame.
// Reads model positions from the graph snapshot and maps them into a fixed box.
export default function Minimap({ snapshot, onRecenter }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const model = useMemo(() => {
    if (!snapshot || snapshot.nodes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of snapshot.nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    }
    // Include the viewport so the frame is always representable.
    minX = Math.min(minX, snapshot.view.x1); maxX = Math.max(maxX, snapshot.view.x2);
    minY = Math.min(minY, snapshot.view.y1); maxY = Math.max(maxY, snapshot.view.y2);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
    const offX = PAD + (W - PAD * 2 - spanX * scale) / 2;
    const offY = PAD + (H - PAD * 2 - spanY * scale) / 2;
    const toX = (x: number) => offX + (x - minX) * scale;
    const toY = (y: number) => offY + (y - minY) * scale;
    return { minX, minY, scale, offX, offY, toX, toY };
  }, [snapshot]);

  if (!snapshot || !model) return null;

  const { toX, toY, scale, minX, minY, offX, offY } = model;
  const v = snapshot.view;

  // Map a click in minimap pixel space back to model coordinates.
  const recenterFromEvent = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const py = ((clientY - rect.top) / rect.height) * H;
    onRecenter(minX + (px - offX) / scale, minY + (py - offY) / scale);
  };

  return (
    <svg
      ref={svgRef}
      className="minimap"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Graph overview"
      onMouseDown={(e) => {
        recenterFromEvent(e.clientX, e.clientY);
        const move = (ev: MouseEvent) => recenterFromEvent(ev.clientX, ev.clientY);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
    >
      {snapshot.nodes.map((n) => (
        <circle key={n.id} cx={toX(n.x)} cy={toY(n.y)} r={1.6} fill={n.color || '#b6b6b6'} className="mm-node" />
      ))}
      <rect
        className="mm-view"
        x={toX(v.x1)} y={toY(v.y1)}
        width={Math.max(4, (v.x2 - v.x1) * scale)}
        height={Math.max(4, (v.y2 - v.y1) * scale)}
      />
    </svg>
  );
}
