// Small hand-built charts for the executive dashboard (no chart library).
// Palette: categorical slots 1-3 of the dataviz reference palette, validated all-pairs
// (CVD ΔE 9.2, normal-vision 24.0). Aqua sits below 3:1 on white, so every chart carries
// direct value labels and the official report table on the same page is the table view.
import { useState } from 'react';

export const SERIES = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a' };
const INK = '#0F172A';
const INK_2 = '#475569';
const GRID = '#E2E8F0';

export function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: 'white', borderRadius: 12, padding: '14px 16px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 0 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: INK, margin: '0 0 2px' }}>{title}</h3>
      {note && <div style={{ fontSize: '0.78rem', color: INK_2, marginBottom: 8 }}>{note}</div>}
      {children}
    </section>
  );
}

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.8rem', color: INK_2, margin: '4px 0 10px' }}>
      {items.map(i => (
        <span key={i.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color }} />{i.name}
        </span>
      ))}
    </div>
  );
}

/** Hover readout that follows the pointer inside a relatively positioned chart */
function Tip({ at, children }: { at: { x: number | string; y: number } | null; children: React.ReactNode }) {
  if (!at) return null;
  return (
    <div role="status" style={{
      position: 'absolute', left: at.x, top: at.y, transform: 'translate(-50%, calc(-100% - 10px))', pointerEvents: 'none',
      background: INK, color: 'white', borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem', whiteSpace: 'nowrap', zIndex: 5,
      boxShadow: '0 4px 12px rgba(15,23,42,0.25)',
    }}>{children}</div>
  );
}

function useTip<T>() {
  const [tip, setTip] = useState<{ x: number; y: number; item: T } | null>(null);
  const show = (e: React.PointerEvent | React.FocusEvent, item: T) => {
    const box = (e.currentTarget as HTMLElement).closest('[data-chart]')!.getBoundingClientRect();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX : r.left + r.width / 2;
    setTip({ x: x - box.left, y: r.top - box.top, item });
  };
  return { tip, show, hide: () => setTip(null) };
}

export interface StackRow { label: string; values: number[]; note?: string }

/** 100% stacked horizontal bars, one row per class; rows without data show their note */
export function StackedBars({ rows, series, labelOf }: {
  rows: StackRow[];
  series: { name: string; color: string }[];
  labelOf: (row: StackRow) => string;
}) {
  const { tip, show, hide } = useTip<{ row: StackRow; i: number }>();
  return (
    <div data-chart style={{ position: 'relative' }}>
      <Legend items={series} />
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 10px', alignItems: 'center' }}>
        {rows.map(row => {
          const total = row.values.reduce((a, b) => a + b, 0);
          return [
            <div key={`${row.label}-l`} style={{ fontSize: '0.82rem', fontWeight: 700, color: INK }}>{row.label}</div>,
            <div key={`${row.label}-b`} style={{ display: 'flex', gap: 2, height: 16 }}>
              {total === 0
                ? <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 4 }} />
                : row.values.map((v, i) => v > 0 && (
                  <div key={i} tabIndex={0} aria-label={`${row.label} ${series[i].name} ${v} คน`}
                    onPointerMove={e => show(e, { row, i })} onPointerLeave={hide} onFocus={e => show(e, { row, i })} onBlur={hide}
                    style={{ flexGrow: v, flexBasis: 0, minWidth: 3, background: series[i].color, borderRadius: 4, cursor: 'default' }} />
                ))}
            </div>,
            <div key={`${row.label}-v`} style={{ fontSize: '0.8rem', color: total ? INK : INK_2, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {total ? labelOf(row) : row.note}
            </div>,
          ];
        })}
      </div>
      <Tip at={tip}>{tip && <><b>{tip.item.row.values[tip.item.i]} คน</b> {series[tip.item.i].name} · {tip.item.row.label}</>}</Tip>
    </div>
  );
}

/** Single-series horizontal bars with an optional dashed reference line */
export function HBars({ rows, max, format, reference, color = SERIES.blue }: {
  rows: { label: string; value: number | null; detail?: string }[];
  max: number;
  format: (v: number) => string;
  reference?: { value: number; label: string };
  color?: string;
}) {
  const { tip, show, hide } = useTip<{ label: string; value: number; detail?: string }>();
  return (
    <div data-chart style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 10px', alignItems: 'center' }}>
        {rows.map(r => [
          <div key={`${r.label}-l`} style={{ fontSize: '0.82rem', fontWeight: 700, color: INK }}>{r.label}</div>,
          <div key={`${r.label}-b`} style={{ position: 'relative', height: 16 }}>
            {reference && <div aria-hidden="true" style={{ position: 'absolute', left: `${(reference.value / max) * 100}%`, top: -3, bottom: -3, borderLeft: `1px dashed ${INK_2}` }} />}
            {r.value !== null && r.value > 0 && (
              <div tabIndex={0} aria-label={`${r.label} ${format(r.value)}`}
                onPointerMove={e => show(e, { label: r.label, value: r.value!, detail: r.detail })} onPointerLeave={hide}
                onFocus={e => show(e, { label: r.label, value: r.value!, detail: r.detail })} onBlur={hide}
                style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, height: '100%', background: color, borderRadius: '0 4px 4px 0' }} />
            )}
          </div>,
          <div key={`${r.label}-v`} style={{ fontSize: '0.8rem', color: r.value ? INK : INK_2, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
            {r.value ? format(r.value) : '-'}
          </div>,
        ])}
      </div>
      {reference && <div style={{ fontSize: '0.75rem', color: INK_2, marginTop: 8 }}>เส้นประ = {reference.label}</div>}
      <Tip at={tip}>{tip && <><b>{format(tip.item.value)}</b> {tip.item.label}{tip.item.detail ? ` · ${tip.item.detail}` : ''}</>}</Tip>
    </div>
  );
}

/** Line over school days with a crosshair readout; the y-axis starts near the data, not at zero */
export function TrendLine({ points, color = SERIES.blue, format, selected, onSelect }: {
  points: { key: string; label: string; value: number; detail: string }[];
  color?: string;
  format: (v: number) => string;
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div style={{ padding: '2rem 0', textAlign: 'center', color: INK_2, fontSize: '0.88rem' }}>ข้อมูลยังไม่พอแสดงแนวโน้ม (ต้องมีอย่างน้อย 2 วันที่เช็คชื่อ)</div>;

  const W = 640, H = 200, L = 40, R = 12, T = 12, B = 26;
  const lo = Math.max(0, Math.floor((Math.min(...points.map(p => p.value)) - 5) / 10) * 10);
  const hi = 100;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ticks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10).filter((_, i, a) => a.length <= 6 || i % 2 === 0);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const h = hover ?? null;

  const pick = (clientX: number, svg: SVGSVGElement) => {
    const box = svg.getBoundingClientRect();
    const vx = ((clientX - box.left) / box.width) * W;
    setHover(Math.max(0, Math.min(last, Math.round(((vx - L) / (W - L - R)) * last))));
  };

  return (
    <div data-chart style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="แนวโน้มร้อยละการมาเรียนรายวัน"
        style={{ display: 'block', touchAction: 'pan-y', cursor: onSelect ? 'pointer' : 'default' }}
        onPointerMove={e => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}
        onClick={() => h !== null && onSelect?.(points[h].key)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK_2}>{t}%</text>
          </g>
        ))}
        {[0, Math.floor(last / 2), last].map(i => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize={11} fill={INK_2}>{points[i].label}</text>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => p.key === selected && (
          <circle key={p.key} cx={x(i)} cy={y(p.value)} r={5} fill={color} stroke="white" strokeWidth={2} />
        ))}
        <circle cx={x(last)} cy={y(points[last].value)} r={4} fill={color} stroke="white" strokeWidth={2} />
        <text x={x(last) - 6} y={y(points[last].value) - 8} textAnchor="end" fontSize={12} fontWeight={700} fill={INK}>{format(points[last].value)}</text>
        {h !== null && (
          <g pointerEvents="none">
            <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke={INK_2} strokeWidth={1} />
            <circle cx={x(h)} cy={y(points[h].value)} r={5} fill={color} stroke="white" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h !== null && (
        <Tip at={{ x: `${(x(h) / W) * 100}%`, y: 0 }}>
          <b>{format(points[h].value)}</b> {points[h].label} · {points[h].detail}{onSelect ? ' · คลิกเพื่อดูวันนั้น' : ''}
        </Tip>
      )}
    </div>
  );
}
