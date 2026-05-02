import { useState } from 'react';
import { BUILDINGS, STATUS_COLOR, CATEGORY_ICON } from '../data/buildings';

// ─── Isometric campus map (3D look, fully drawn in SVG) ──────────
const COS30 = 0.866;
const SIN30 = 0.5;
const iso = (x: number, y: number, z = 0) => ({
  x: (x - y) * COS30,
  y: (x + y) * SIN30 - z,
});

type Plot = { id: string; x: number; y: number; w: number; d: number; h: number };

const PLOTS: Plot[] = [
  // Top row — teacher housing (back of campus)
  { id: 'th1', x: 60,  y: 60,  w: 70,  d: 55, h: 55 },
  { id: 'th2', x: 165, y: 60,  w: 75,  d: 55, h: 70 },
  { id: 'th3', x: 270, y: 60,  w: 75,  d: 55, h: 60 },

  // Second row — main academic
  { id: 'mp1', x: 50,  y: 170, w: 90,  d: 65, h: 50 },
  { id: 'cl1', x: 175, y: 170, w: 130, d: 60, h: 80 },
  { id: 'cl4', x: 340, y: 170, w: 110, d: 55, h: 50 },
  { id: 'lb1', x: 485, y: 170, w: 85,  d: 60, h: 55 },

  // Third row
  { id: 'cl2', x: 175, y: 270, w: 130, d: 55, h: 80 },
  { id: 'cl3', x: 340, y: 270, w: 110, d: 55, h: 80 },
  { id: 'lb2', x: 485, y: 270, w: 85,  d: 55, h: 50 },

  // Fourth row — dorms & cafeteria
  { id: 'sh1', x: 50,  y: 410, w: 85,  d: 50, h: 45 },
  { id: 'sh2', x: 165, y: 410, w: 75,  d: 50, h: 45 },
  { id: 'sh5', x: 275, y: 410, w: 100, d: 50, h: 45 },
  { id: 'cf1', x: 410, y: 410, w: 110, d: 60, h: 55 },

  // Fifth row — bottom
  { id: 'sh3', x: 50,  y: 495, w: 85,  d: 45, h: 40 },
  { id: 'sh4', x: 165, y: 495, w: 95,  d: 45, h: 40 },
  { id: 'tl1', x: 290, y: 495, w: 50,  d: 40, h: 35 },
  { id: 'tl2', x: 350, y: 495, w: 50,  d: 40, h: 35 },
  { id: 'tl3', x: 410, y: 495, w: 50,  d: 40, h: 35 },
  { id: 'jh1', x: 480, y: 495, w: 65,  d: 50, h: 60 },
];

const SPORTS = { x: 340, y: 320, w: 220, d: 80 };

// Playground area (top-right)
const PLAYGROUND = { x: 480, y: 60, w: 110, d: 90 };

const TREES: Array<{ x: number; y: number; size: number }> = [
  { x: 20, y: 20, size: 18 }, { x: 35, y: 50, size: 22 }, { x: 595, y: 30, size: 20 },
  { x: 605, y: 75, size: 18 }, { x: 20, y: 250, size: 20 }, { x: 605, y: 280, size: 22 },
  { x: 25, y: 400, size: 18 }, { x: 605, y: 400, size: 20 }, { x: 30, y: 560, size: 22 },
  { x: 590, y: 555, size: 20 }, { x: 280, y: 580, size: 16 }, { x: 380, y: 580, size: 18 },
  { x: 470, y: 580, size: 16 }, { x: 145, y: 145, size: 14 }, { x: 460, y: 145, size: 14 },
  { x: 145, y: 380, size: 14 }, { x: 460, y: 380, size: 14 }, { x: 320, y: 245, size: 12 },
];

const WORLD_W = 620;
const WORLD_D = 620;

const corners = [iso(0, 0), iso(WORLD_W, 0), iso(WORLD_W, WORLD_D), iso(0, WORLD_D)];
const minX = Math.min(...corners.map(c => c.x));
const maxX = Math.max(...corners.map(c => c.x));
const minY = Math.min(...corners.map(c => c.y));
const maxY = Math.max(...corners.map(c => c.y)) + 100;
const VIEW_W = maxX - minX + 40;
const VIEW_H = maxY - minY + 40;
const OFFSET_X = -minX + 20;
const OFFSET_Y = -minY + 20;

const project = (x: number, y: number, z = 0) => {
  const p = iso(x, y, z);
  return { x: p.x + OFFSET_X, y: p.y + OFFSET_Y };
};

const darken = (hex: string, amt = 0.25) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};
const lighten = (hex: string, amt = 0.15) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const m = (v: number) => Math.round(v + (255 - v) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
};

interface IsoBuildingProps {
  plot: Plot;
  building: typeof BUILDINGS[number];
  hovered: boolean;
  onHover: (id: string | null) => void;
}

function IsoBuilding({ plot, building, hovered, onHover }: IsoBuildingProps) {
  const { x, y, w, d, h: rawH } = plot;
  const h = building.floors === 2 ? rawH * 1.15 : rawH * 0.85;

  const g10 = project(x + w, y);
  const g11 = project(x + w, y + d);
  const g01 = project(x, y + d);
  const t00 = project(x, y, h);
  const t10 = project(x + w, y, h);
  const t11 = project(x + w, y + d, h);
  const t01 = project(x, y + d, h);

  const wall = building.wallColor;
  const wallShade = darken(wall, 0.18);
  const roof = building.roofColor;

  const pitched = building.shape !== 'block';
  const peakBack = pitched ? project(x + w / 2, y, h + 22) : null;
  const peakFront = pitched ? project(x + w / 2, y + d, h + 22) : null;

  const center = project(x + w / 2, y + d / 2, h + (pitched ? 28 : 8));

  return (
    <g
      onMouseEnter={() => onHover(building.id)}
      onMouseLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Right face (darker) */}
      <polygon
        points={`${g10.x},${g10.y} ${g11.x},${g11.y} ${t11.x},${t11.y} ${t10.x},${t10.y}`}
        fill={wallShade}
        stroke={darken(wall, 0.5)} strokeWidth="0.6"
      />
      {/* Front face (main wall color) */}
      <polygon
        points={`${g01.x},${g01.y} ${g11.x},${g11.y} ${t11.x},${t11.y} ${t01.x},${t01.y}`}
        fill={wall}
        stroke={darken(wall, 0.5)} strokeWidth="0.6"
      />

      {/* Windows on front face */}
      {(() => {
        const cols = Math.max(2, Math.floor(w / 22));
        const floors = building.floors;
        const winH = (h / floors) * 0.5;
        const cellW = (w - 8) / cols;
        const winW = cellW * 0.65;
        const offX = (cellW - winW) / 2;
        const wins = [];
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < cols; c++) {
            const wx = x + 4 + c * cellW + offX;
            const wz0 = (h / floors) * f + (h / floors - winH) / 2;
            const wz1 = wz0 + winH;
            const a = project(wx, y + d, wz0);
            const b = project(wx + winW, y + d, wz0);
            const cc = project(wx + winW, y + d, wz1);
            const dpt = project(wx, y + d, wz1);
            wins.push(
              <polygon key={`${f}-${c}`}
                points={`${a.x},${a.y} ${b.x},${b.y} ${cc.x},${cc.y} ${dpt.x},${dpt.y}`}
                fill="#A8DDF0" stroke={darken(wall, 0.5)} strokeWidth="0.4" />
            );
          }
        }
        return <g opacity={0.9}>{wins}</g>;
      })()}

      {/* Door on front center */}
      {(() => {
        const doorW = 9;
        const doorH = Math.min(h * 0.4, 18);
        const dx = x + w / 2 - doorW / 2;
        const a = project(dx, y + d, 0);
        const b = project(dx + doorW, y + d, 0);
        const c = project(dx + doorW, y + d, doorH);
        const dpt = project(dx, y + d, doorH);
        return (
          <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${dpt.x},${dpt.y}`}
            fill={darken(roof, 0.2)} stroke={darken(roof, 0.5)} strokeWidth="0.5" />
        );
      })()}

      {/* Roof — flat or pitched */}
      {pitched && peakBack && peakFront ? (
        <>
          {/* Left slope */}
          <polygon
            points={`${t00.x},${t00.y} ${t01.x},${t01.y} ${peakFront.x},${peakFront.y} ${peakBack.x},${peakBack.y}`}
            fill={roof} stroke={darken(roof, 0.4)} strokeWidth="0.6"
          />
          {/* Right slope */}
          <polygon
            points={`${t10.x},${t10.y} ${t11.x},${t11.y} ${peakFront.x},${peakFront.y} ${peakBack.x},${peakBack.y}`}
            fill={darken(roof, 0.15)} stroke={darken(roof, 0.4)} strokeWidth="0.6"
          />
          {/* Back gable */}
          <polygon
            points={`${t00.x},${t00.y} ${t10.x},${t10.y} ${peakBack.x},${peakBack.y}`}
            fill={lighten(wall, 0.1)} stroke={darken(wall, 0.4)} strokeWidth="0.6"
          />
          {/* Front gable */}
          <polygon
            points={`${t01.x},${t01.y} ${t11.x},${t11.y} ${peakFront.x},${peakFront.y}`}
            fill={wall} stroke={darken(wall, 0.4)} strokeWidth="0.6"
          />
        </>
      ) : (
        <polygon
          points={`${t00.x},${t00.y} ${t10.x},${t10.y} ${t11.x},${t11.y} ${t01.x},${t01.y}`}
          fill={roof} stroke={darken(roof, 0.4)} strokeWidth="0.6"
        />
      )}

      {/* Status indicator */}
      <circle cx={center.x} cy={center.y} r="3.5" fill={STATUS_COLOR[building.status]}
        stroke="white" strokeWidth="1.2" />

      {/* Hover tooltip */}
      {hovered && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={center.x - 75} y={center.y - 42} width="150" height="32"
            fill="white" stroke={darken(wall, 0.5)} strokeWidth="1" rx="6"
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))' }} />
          <text x={center.x} y={center.y - 26} textAnchor="middle"
            fontSize="9" fontWeight="800" fill="#0F172A">
            {CATEGORY_ICON[building.category] || '🏗️'} {building.name}
          </text>
          <text x={center.x} y={center.y - 15} textAnchor="middle"
            fontSize="7.5" fill={STATUS_COLOR[building.status]} fontWeight="700">
            {building.category} · {building.status}
          </text>
        </g>
      )}
    </g>
  );
}

function IsoTree({ x, y, size }: { x: number; y: number; size: number }) {
  const trunkBase = project(x, y, 0);
  const trunkTop = project(x, y, size * 0.55);
  const top = project(x, y, size * 1.7);
  const leftBase = project(x - size * 0.45, y, size * 0.6);
  const rightBase = project(x + size * 0.45, y, size * 0.6);
  const frontBase = project(x, y + size * 0.45, size * 0.6);
  const backBase = project(x, y - size * 0.45, size * 0.6);
  return (
    <g>
      <line x1={trunkBase.x} y1={trunkBase.y} x2={trunkTop.x} y2={trunkTop.y}
        stroke="#5D4037" strokeWidth={size * 0.2} strokeLinecap="round" />
      <ellipse cx={backBase.x} cy={backBase.y - size * 0.3} rx={size * 0.5} ry={size * 0.42} fill="#1B5E20" opacity="0.85" />
      <ellipse cx={trunkTop.x} cy={top.y + size * 0.25} rx={size * 0.75} ry={size * 0.65} fill="#2E7D32" />
      <ellipse cx={leftBase.x} cy={leftBase.y - size * 0.3} rx={size * 0.52} ry={size * 0.42} fill="#388E3C" />
      <ellipse cx={rightBase.x} cy={rightBase.y - size * 0.3} rx={size * 0.52} ry={size * 0.42} fill="#43A047" />
      <ellipse cx={frontBase.x} cy={frontBase.y - size * 0.3} rx={size * 0.55} ry={size * 0.45} fill="#4CAF50" />
    </g>
  );
}

// Playground decoration (mushroom, slide, fence)
function Playground({ area }: { area: typeof PLAYGROUND }) {
  const { x, y, w, d } = area;
  const a = project(x, y, 0);
  const b = project(x + w, y, 0);
  const c = project(x + w, y + d, 0);
  const dpt = project(x, y + d, 0);
  // Mushroom (red with white spots)
  const m = project(x + 25, y + 20, 0);
  const mTop = project(x + 25, y + 20, 22);
  // Slide tower
  const s = project(x + w - 30, y + d - 25, 0);
  const sTop = project(x + w - 30, y + d - 25, 18);
  return (
    <g>
      {/* Sand/dirt area */}
      <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${dpt.x},${dpt.y}`}
        fill="#F5DEB3" stroke="#C2A878" strokeWidth="1" opacity="0.85" />
      {/* Fence posts */}
      {[0, 0.33, 0.66, 1].map(t => {
        const p1 = project(x + t * w, y, 0);
        const p2 = project(x + t * w, y, 8);
        const p3 = project(x + t * w, y + d, 0);
        const p4 = project(x + t * w, y + d, 8);
        return (
          <g key={t}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#8D6E63" strokeWidth="1.5" />
            <line x1={p3.x} y1={p3.y} x2={p4.x} y2={p4.y} stroke="#8D6E63" strokeWidth="1.5" />
          </g>
        );
      })}
      {/* Mushroom */}
      <line x1={m.x} y1={m.y} x2={mTop.x} y2={mTop.y} stroke="#FAFAFA" strokeWidth="3" />
      <ellipse cx={mTop.x} cy={mTop.y - 4} rx="9" ry="6" fill="#E53935" />
      <circle cx={mTop.x - 3} cy={mTop.y - 5} r="1.5" fill="white" />
      <circle cx={mTop.x + 2} cy={mTop.y - 6} r="1.2" fill="white" />
      <circle cx={mTop.x + 4} cy={mTop.y - 3} r="1" fill="white" />
      {/* Carousel/slide tower */}
      <line x1={s.x} y1={s.y} x2={sTop.x} y2={sTop.y} stroke="#C0392B" strokeWidth="2" />
      <ellipse cx={sTop.x} cy={sTop.y - 3} rx="10" ry="5" fill="#E74C3C" />
      <ellipse cx={sTop.x} cy={sTop.y - 3} rx="10" ry="5" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 2" />
    </g>
  );
}

export default function CampusMap() {
  const [hovered, setHovered] = useState<string | null>(null);

  const c00 = project(0, 0);
  const c10 = project(WORLD_W, 0);
  const c11 = project(WORLD_W, WORLD_D);
  const c01 = project(0, WORLD_D);

  const DIRT_DEPTH = 35;
  const c01d = { x: c01.x, y: c01.y + DIRT_DEPTH };
  const c11d = { x: c11.x, y: c11.y + DIRT_DEPTH };
  const c10d = { x: c10.x, y: c10.y + DIRT_DEPTH };

  const sorted = [...PLOTS].sort((a, b) => (a.x + a.y) - (b.x + b.y));

  return (
    <div style={{
      borderRadius: 24,
      padding: 14,
      background: 'linear-gradient(180deg, #BFE0F5 0%, #DCEEFA 100%)',
      border: '2px solid #FFEDD5',
      boxShadow: '0 20px 50px rgba(15,23,42,0.12)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 24, left: 24, zIndex: 2,
        background: 'rgba(255,255,255,0.95)', padding: '8px 14px', borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}>
        <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.92rem' }}>
          🗺️ แผนผังโรงเรียนบ้านคลองมดแดง
        </div>
        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
          มุมมองอิโซเมตริก 3 มิติ · {BUILDINGS.length} อาคาร
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 24, right: 24, zIndex: 2,
        background: 'rgba(255,255,255,0.95)', padding: '8px 12px', borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', gap: 12, fontSize: '0.75rem', fontWeight: 700,
      }}>
        {(['ดี', 'พอใช้', 'ทรุดโทรม'] as const).map(s => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#0F172A' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[s] }} />
            {s}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="grass-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7AC76D" />
            <stop offset="100%" stopColor="#5BA850" />
          </linearGradient>
          <linearGradient id="dirt-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8D6E63" />
            <stop offset="100%" stopColor="#5D4037" />
          </linearGradient>
          <pattern id="grass-dots" patternUnits="userSpaceOnUse" width="14" height="14">
            <circle cx="3" cy="4" r="0.6" fill="#5BA850" opacity="0.5" />
            <circle cx="9" cy="9" r="0.5" fill="#5BA850" opacity="0.4" />
          </pattern>
          <pattern id="field-stripes" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(30)">
            <rect width="10" height="10" fill="#4CAF50" />
            <rect width="10" height="5" fill="#5DC962" />
          </pattern>
        </defs>

        {/* Earth/dirt sides */}
        <polygon points={`${c01.x},${c01.y} ${c11.x},${c11.y} ${c11d.x},${c11d.y} ${c01d.x},${c01d.y}`} fill="url(#dirt-grad)" />
        <polygon points={`${c11.x},${c11.y} ${c10.x},${c10.y} ${c10d.x},${c10d.y} ${c11d.x},${c11d.y}`} fill={darken('#8D6E63', 0.25)} />

        {/* Grass top */}
        <polygon
          points={`${c00.x},${c00.y} ${c10.x},${c10.y} ${c11.x},${c11.y} ${c01.x},${c01.y}`}
          fill="url(#grass-grad)"
          stroke="#3F7A38" strokeWidth="1.2"
        />
        <polygon
          points={`${c00.x},${c00.y} ${c10.x},${c10.y} ${c11.x},${c11.y} ${c01.x},${c01.y}`}
          fill="url(#grass-dots)"
        />

        {/* Paths between rows */}
        {[150, 380].map((py, i) => {
          const a = project(30, py);
          const b = project(WORLD_W - 30, py);
          const c = project(WORLD_W - 30, py + 16);
          const d = project(30, py + 16);
          return (
            <polygon key={i} points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
              fill="#9E8B6B" stroke="#7A6A50" strokeWidth="0.6" />
          );
        })}

        {/* Sports field */}
        {(() => {
          const a = project(SPORTS.x, SPORTS.y, 0.5);
          const b = project(SPORTS.x + SPORTS.w, SPORTS.y, 0.5);
          const c = project(SPORTS.x + SPORTS.w, SPORTS.y + SPORTS.d, 0.5);
          const d = project(SPORTS.x, SPORTS.y + SPORTS.d, 0.5);
          const cx = (a.x + c.x) / 2;
          const cy = (a.y + c.y) / 2;
          // Center line
          const ml1 = project(SPORTS.x + SPORTS.w / 2, SPORTS.y, 0.5);
          const ml2 = project(SPORTS.x + SPORTS.w / 2, SPORTS.y + SPORTS.d, 0.5);
          // Goal areas
          const gA1 = project(SPORTS.x, SPORTS.y + SPORTS.d * 0.3, 0.5);
          const gA2 = project(SPORTS.x + SPORTS.w * 0.1, SPORTS.y + SPORTS.d * 0.3, 0.5);
          const gA3 = project(SPORTS.x + SPORTS.w * 0.1, SPORTS.y + SPORTS.d * 0.7, 0.5);
          const gA4 = project(SPORTS.x, SPORTS.y + SPORTS.d * 0.7, 0.5);
          const gB1 = project(SPORTS.x + SPORTS.w, SPORTS.y + SPORTS.d * 0.3, 0.5);
          const gB2 = project(SPORTS.x + SPORTS.w * 0.9, SPORTS.y + SPORTS.d * 0.3, 0.5);
          const gB3 = project(SPORTS.x + SPORTS.w * 0.9, SPORTS.y + SPORTS.d * 0.7, 0.5);
          const gB4 = project(SPORTS.x + SPORTS.w, SPORTS.y + SPORTS.d * 0.7, 0.5);
          return (
            <g>
              <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
                fill="url(#field-stripes)" stroke="white" strokeWidth="2" />
              <line x1={ml1.x} y1={ml1.y} x2={ml2.x} y2={ml2.y} stroke="white" strokeWidth="1.5" />
              <ellipse cx={cx} cy={cy} rx={SPORTS.w * 0.06} ry={SPORTS.d * 0.16}
                fill="none" stroke="white" strokeWidth="1.5" />
              {/* Goal boxes */}
              <polygon points={`${gA1.x},${gA1.y} ${gA2.x},${gA2.y} ${gA3.x},${gA3.y} ${gA4.x},${gA4.y}`}
                fill="none" stroke="white" strokeWidth="1.5" />
              <polygon points={`${gB1.x},${gB1.y} ${gB2.x},${gB2.y} ${gB3.x},${gB3.y} ${gB4.x},${gB4.y}`}
                fill="none" stroke="white" strokeWidth="1.5" />
            </g>
          );
        })()}

        {/* Playground area */}
        <Playground area={PLAYGROUND} />

        {/* Buildings (back-to-front) */}
        {sorted.map(plot => {
          const b = BUILDINGS.find(x => x.id === plot.id);
          if (!b) return null;
          return (
            <IsoBuilding key={plot.id} plot={plot} building={b}
              hovered={hovered === plot.id} onHover={setHovered} />
          );
        })}

        {/* Trees on top */}
        {[...TREES].sort((a, b) => (a.x + a.y) - (b.x + b.y)).map((t, i) => (
          <IsoTree key={i} x={t.x} y={t.y} size={t.size} />
        ))}
      </svg>

      <div style={{
        marginTop: 10, fontSize: '0.78rem', color: '#64748B',
        textAlign: 'center', fontStyle: 'italic',
      }}>
        💡 เลื่อนเมาส์ไปที่อาคารเพื่อดูรายละเอียด
      </div>

      {/* Building list */}
      <div style={{ marginTop: 16 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
        }}>
          {BUILDINGS.map(b => (
            <div key={b.id} style={{
              background: 'white', padding: '10px 12px', borderRadius: 10,
              borderLeft: `4px solid ${STATUS_COLOR[b.status]}`,
              display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}>
              <span style={{ fontSize: '1.2rem' }}>{CATEGORY_ICON[b.category] || '🏗️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{b.category}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
