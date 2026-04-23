import { BUILDINGS, STATUS_COLOR, CATEGORY_ICON } from '../data/buildings';

// Clean top-down site plan — like an architect's drawing.
// Each building = labeled rectangle in a category color, positioned on a grass canvas
// with paths, sports field, and trees.

type Plot = {
  id: string;
  x: number; y: number; w: number; h: number;
};

// World canvas: 1000 × 700
const PLOTS: Plot[] = [
  // === Top zone: teacher housing ===
  { id: 'th1', x: 70,  y: 60,  w: 100, h: 70 },
  { id: 'th2', x: 200, y: 60,  w: 110, h: 70 },
  { id: 'th3', x: 340, y: 60,  w: 110, h: 70 },

  // === Middle zone: main academic buildings ===
  { id: 'mp1', x: 70,  y: 200, w: 130, h: 90 },   // Multi-purpose hall
  { id: 'cl1', x: 230, y: 200, w: 200, h: 80 },   // Classroom (purple) 2-story
  { id: 'cl4', x: 460, y: 200, w: 180, h: 70 },   // Kindergarten (pink)
  { id: 'lb1', x: 670, y: 200, w: 130, h: 80 },   // Library

  // === Lower-middle zone ===
  { id: 'cl2', x: 230, y: 320, w: 200, h: 70 },   // Classroom (blue)
  { id: 'cl3', x: 460, y: 320, w: 180, h: 70 },   // Classroom (dark blue)
  { id: 'lb2', x: 670, y: 320, w: 130, h: 70 },   // Library 2

  // === Sports field ===
  // (drawn separately as a feature, not a building)

  // === Bottom zone: dorms, cafeteria, toilets ===
  { id: 'sh1', x: 70,  y: 460, w: 130, h: 60 },
  { id: 'sh2', x: 215, y: 460, w: 110, h: 60 },
  { id: 'sh3', x: 70,  y: 540, w: 130, h: 50 },
  { id: 'sh4', x: 215, y: 540, w: 130, h: 50 },
  { id: 'sh5', x: 360, y: 460, w: 150, h: 60 },
  { id: 'tl1', x: 360, y: 540, w: 70, h: 50 },
  { id: 'tl2', x: 445, y: 540, w: 70, h: 50 },
  { id: 'tl3', x: 530, y: 540, w: 70, h: 50 },
  { id: 'cf1', x: 620, y: 460, w: 160, h: 80 },   // Cafeteria
  { id: 'jh1', x: 620, y: 555, w: 100, h: 55 },   // Janitor housing
];

const SPORTS_FIELD = { x: 460, y: 410, w: 340, h: 40 };
const TREES = [
  { x: 30, y: 30 }, { x: 970, y: 30 }, { x: 30, y: 670 }, { x: 970, y: 670 },
  { x: 500, y: 30 }, { x: 30, y: 350 }, { x: 970, y: 350 }, { x: 500, y: 670 },
  { x: 165, y: 165 }, { x: 320, y: 295 }, { x: 525, y: 290 }, { x: 825, y: 295 },
  { x: 165, y: 425 }, { x: 825, y: 425 }, { x: 320, y: 605 }, { x: 600, y: 605 },
];

export default function CampusMap() {
  const W = 1000, H = 700;

  return (
    <div style={{
      borderRadius: 24,
      padding: 14,
      background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
      border: '2px solid #FFEDD5',
      boxShadow: '0 20px 50px rgba(15,23,42,0.12)',
    }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', borderRadius: 16, background: '#86C97D' }}>
        <defs>
          <pattern id="grass-tex" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#86C97D" />
            <circle cx="5" cy="7" r="0.8" fill="#6BB561" />
            <circle cx="14" cy="3" r="0.6" fill="#6BB561" />
            <circle cx="11" cy="15" r="0.7" fill="#6BB561" />
            <circle cx="2" cy="17" r="0.5" fill="#6BB561" />
          </pattern>
          <pattern id="field-stripes" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#9BD491" />
            <rect width="20" height="10" fill="#A8DC9E" />
          </pattern>
        </defs>

        {/* Grass background */}
        <rect width={W} height={H} fill="url(#grass-tex)" />

        {/* Property border */}
        <rect x="6" y="6" width={W - 12} height={H - 12} fill="none"
          stroke="#0F172A" strokeWidth="3" strokeDasharray="0" rx="8" />
        <rect x="14" y="14" width={W - 28} height={H - 28} fill="none"
          stroke="rgba(15,23,42,0.25)" strokeWidth="1" strokeDasharray="4 3" rx="6" />

        {/* Main paths */}
        <rect x="40" y="160" width={W - 80} height="20" fill="#D4B896" stroke="#A88C5F" strokeWidth="1" rx="3" />
        <rect x="40" y="295" width={W - 80} height="20" fill="#D4B896" stroke="#A88C5F" strokeWidth="1" rx="3" />
        <rect x="40" y="430" width={W - 80} height="20" fill="#D4B896" stroke="#A88C5F" strokeWidth="1" rx="3" />
        <rect x="180" y="40" width="20" height={H - 80} fill="#D4B896" stroke="#A88C5F" strokeWidth="1" rx="3" />
        <rect x="660" y="40" width="20" height={H - 80} fill="#D4B896" stroke="#A88C5F" strokeWidth="1" rx="3" />

        {/* Sports field */}
        <g>
          <rect
            x={SPORTS_FIELD.x} y={SPORTS_FIELD.y}
            width={SPORTS_FIELD.w} height={SPORTS_FIELD.h}
            fill="url(#field-stripes)" stroke="white" strokeWidth="2" rx="4"
          />
          <ellipse
            cx={SPORTS_FIELD.x + SPORTS_FIELD.w / 2}
            cy={SPORTS_FIELD.y + SPORTS_FIELD.h / 2}
            rx="20" ry="10"
            fill="none" stroke="white" strokeWidth="1.5"
          />
          <text
            x={SPORTS_FIELD.x + SPORTS_FIELD.w / 2}
            y={SPORTS_FIELD.y - 6}
            fontSize="14" fontWeight="800" fill="#0F172A" textAnchor="middle"
          >⚽ สนามกีฬา</text>
        </g>

        {/* Trees */}
        {TREES.map((t, i) => (
          <g key={i}>
            <ellipse cx={t.x + 1} cy={t.y + 12} rx="11" ry="4" fill="rgba(0,0,0,0.18)" />
            <circle cx={t.x} cy={t.y} r="11" fill="#3F8B3F" stroke="#1F5A1F" strokeWidth="1" />
            <circle cx={t.x - 3} cy={t.y - 3} r="6" fill="#5DAA5D" />
          </g>
        ))}

        {/* Buildings */}
        {PLOTS.map(p => {
          const b = BUILDINGS.find(x => x.id === p.id);
          if (!b) return null;
          return (
            <g key={p.id}>
              {/* Drop shadow */}
              <rect x={p.x + 3} y={p.y + 4} width={p.w} height={p.h} fill="rgba(0,0,0,0.22)" rx="6" />
              {/* Roof view (top-down) */}
              <rect
                x={p.x} y={p.y} width={p.w} height={p.h}
                fill={b.roofColor}
                stroke="#0F172A" strokeWidth="2" rx="6"
              />
              {/* Inner wall hint */}
              <rect
                x={p.x + 4} y={p.y + 4} width={p.w - 8} height={p.h - 8}
                fill="none"
                stroke={b.wallColor}
                strokeWidth="2" rx="4"
              />
              {/* Ridge line down the middle (long axis) */}
              {p.w > p.h ? (
                <line x1={p.x + 8} y1={p.y + p.h / 2} x2={p.x + p.w - 8} y2={p.y + p.h / 2}
                  stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
              ) : (
                <line x1={p.x + p.w / 2} y1={p.y + 8} x2={p.x + p.w / 2} y2={p.y + p.h - 8}
                  stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" />
              )}
              {/* Floors indicator (small dots top-right) */}
              {Array.from({ length: b.floors }).map((_, i) => (
                <circle key={i} cx={p.x + p.w - 8 - i * 6} cy={p.y + 8} r="2" fill="white" stroke="#0F172A" strokeWidth="0.6" />
              ))}
              {/* Status pin top-left */}
              <circle cx={p.x + 8} cy={p.y + 8} r="4" fill={STATUS_COLOR[b.status]} stroke="white" strokeWidth="1.5" />
              {/* Icon (centered) */}
              <text
                x={p.x + p.w / 2} y={p.y + p.h / 2 - 4}
                fontSize={Math.min(p.w, p.h) * 0.3}
                textAnchor="middle"
              >{CATEGORY_ICON[b.category] || '🏗️'}</text>
              {/* Label */}
              <text
                x={p.x + p.w / 2} y={p.y + p.h / 2 + Math.min(p.w, p.h) * 0.22}
                fontSize="11" fontWeight="800"
                fill="white" textAnchor="middle"
                stroke="rgba(0,0,0,0.65)" strokeWidth="2.5" paintOrder="stroke"
              >{b.name}</text>
            </g>
          );
        })}

        {/* North arrow */}
        <g transform={`translate(${W - 60}, 50)`}>
          <circle r="22" fill="white" stroke="#0F172A" strokeWidth="1.5" />
          <polygon points="0,-16 -7,8 0,3 7,8" fill="#FF6A01" stroke="#0F172A" strokeWidth="1" />
          <text y="20" fontSize="10" fontWeight="900" textAnchor="middle" fill="#0F172A">N</text>
        </g>

        {/* Title */}
        <g>
          <rect x="20" y="20" width="220" height="36" rx="8" fill="white" stroke="#FF6A01" strokeWidth="2" />
          <text x="130" y="44" fontSize="14" fontWeight="900" textAnchor="middle" fill="#0F172A">🗺️ แผนผังโรงเรียน</text>
        </g>
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 14, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap',
        fontSize: '0.85rem',
      }}>
        {(['ดี', 'พอใช้', 'ทรุดโทรม'] as const).map(s => (
          <span key={s} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: '#0F172A', fontWeight: 700,
            background: 'white', padding: '5px 14px', borderRadius: 50,
            border: `2px solid ${STATUS_COLOR[s]}`,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[s] }} />
            สภาพ{s}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0F172A', fontWeight: 700, background: 'white', padding: '5px 14px', borderRadius: 50, border: '2px solid #D4B896' }}>
          <span style={{ width: 14, height: 6, background: '#D4B896', borderRadius: 2 }} />
          ทางเดิน
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0F172A', fontWeight: 700, background: 'white', padding: '5px 14px', borderRadius: 50, border: '2px solid #9BD491' }}>
          ⚽ สนามกีฬา
        </span>
      </div>
    </div>
  );
}
