'use client';

import { useState } from 'react';
import type { TimelinePoint } from '@/lib/api';

// Series colors validated for CVD safety against the cream surface:
// teal = memories (matches the memory badge family), terracotta = handoffs.
const MEMORY_COLOR = '#009a9a';
const HANDOFF_COLOR = '#cb5521';

const W = 640;
const H = 170;
const PAD = { top: 10, right: 6, bottom: 20, left: 26 };

function shortDate(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// A bar with only its top corners rounded, anchored to the baseline.
function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + rr}`,
    `Q${x},${y} ${x + rr},${y}`,
    `H${x + w - rr}`,
    `Q${x + w},${y} ${x + w},${y + rr}`,
    `V${y + h}`,
    'Z',
  ].join(' ');
}

export default function TimelineChart({ points }: { points: TimelinePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const n = points.length;
  const max = Math.max(2, ...points.map((p) => Math.max(p.memories, p.handoffs)));

  const slot = plotW / Math.max(n, 1);
  const barW = Math.max(2, Math.min(7, (slot - 4) / 2));
  const yFor = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const hFor = (v: number) => (v / max) * plotH;

  const ticks = max <= 4 ? [max] : [Math.round(max / 2), max];
  const labelEvery = n > 14 ? 7 : n > 7 ? 2 : 1;
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="tl">
      <div className="tl-legend" aria-hidden="true">
        <span className="tl-key"><span className="tl-swatch" style={{ background: MEMORY_COLOR }} />memories</span>
        <span className="tl-key"><span className="tl-swatch" style={{ background: HANDOFF_COLOR }} />handoffs</span>
      </div>

      <div className="tl-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Memories and handoffs created per day">
          {/* Recessive gridlines + axis labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yFor(t)} y2={yFor(t)} className="tl-grid" />
              <text x={PAD.left - 6} y={yFor(t) + 3} className="tl-tick" textAnchor="end">{t}</text>
            </g>
          ))}
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="tl-axis" />

          {points.map((p, i) => {
            const x0 = PAD.left + i * slot;
            const cx = x0 + slot / 2;
            return (
              <g key={p.date}>
                {hover === i && (
                  <rect x={x0} y={PAD.top} width={slot} height={plotH} className="tl-hoverband" />
                )}
                {p.memories > 0 && (
                  <path d={topRoundedBar(cx - barW - 1, yFor(p.memories), barW, hFor(p.memories), 2)} fill={MEMORY_COLOR} />
                )}
                {p.handoffs > 0 && (
                  <path d={topRoundedBar(cx + 1, yFor(p.handoffs), barW, hFor(p.handoffs), 2)} fill={HANDOFF_COLOR} />
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 6} className="tl-tick" textAnchor="middle">{shortDate(p.date)}</text>
                )}
                {/* Hover hit target: the whole day column */}
                <rect
                  x={x0} y={PAD.top} width={slot} height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="tl-tooltip"
            style={{ left: `${((PAD.left + (hover! + 0.5) * slot) / W) * 100}%` }}
          >
            <div className="tl-tooltip-date">{shortDate(hovered.date)}</div>
            <div><span className="tl-swatch" style={{ background: MEMORY_COLOR }} /> {hovered.memories} memor{hovered.memories === 1 ? 'y' : 'ies'}</div>
            <div><span className="tl-swatch" style={{ background: HANDOFF_COLOR }} /> {hovered.handoffs} handoff{hovered.handoffs === 1 ? '' : 's'}</div>
          </div>
        )}
      </div>

      {/* Data table for screen readers and copy-paste */}
      <table className="sr-only">
        <caption>Memories and handoffs created per day</caption>
        <thead>
          <tr><th>Date</th><th>Memories</th><th>Handoffs</th></tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}><td>{p.date}</td><td>{p.memories}</td><td>{p.handoffs}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
