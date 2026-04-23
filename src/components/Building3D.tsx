import type { Building } from '../data/buildings';
import { STATUS_COLOR } from '../data/buildings';

function shade(hex: string, percent: number): string {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}

// Complete 3D isometric house.
// Coords: x=right(width), y=back(depth), z=up(height).
// Roof ridge runs along X at y=D/2, z=H+RH. Gables on left/right walls.
export default function Building3D({ b }: { b: Building }) {
  const W = b.width === 1 ? 70 : b.width === 2 ? 95 : 120;
  const D = 55;
  const FH = 32;
  const H = FH * b.floors;
  const RH = 22 + (b.floors - 1) * 4;

  const COS = Math.cos(Math.PI / 6);
  const SIN = Math.sin(Math.PI / 6);
  const proj = (x: number, y: number, z: number) => ({
    sx: (x - y) * COS,
    sy: (x + y) * SIN - z,
  });
  const P = (x: number, y: number, z: number) => {
    const p = proj(x, y, z);
    return `${p.sx.toFixed(2)},${p.sy.toFixed(2)}`;
  };

  const wallFront = b.wallColor;
  const wallSide = shade(b.wallColor, -45);
  const roofFront = shade(b.roofColor, 12);
  const roofBack = shade(b.roofColor, -22);

  // Bounds
  const all = [
    proj(0, 0, 0), proj(W, 0, 0), proj(W, D, 0), proj(0, D, 0),
    proj(0, 0, H + RH), proj(W, 0, H + RH),
    proj(0, D / 2, H + RH), proj(W, D / 2, H + RH),
  ];
  const xs = all.map(c => c.sx), ys = all.map(c => c.sy);
  const pad = 14;
  const vbX = Math.min(...xs) - pad;
  const vbY = Math.min(...ys) - pad;
  const vbW = Math.max(...xs) - vbX + pad;
  const vbH = Math.max(...ys) - vbY + pad + 18;

  // Front wall door + windows
  const winN = b.width === 1 ? 2 : b.width === 2 ? 3 : 4;
  const slotW = W / (winN + 1);
  const winW = Math.min(slotW * 0.6, 14);
  const winH = 10;
  const doorW = Math.min(slotW * 0.5, 10);
  const doorH = 20;

  const windows: { cx: number; cz: number }[] = [];
  for (let f = 0; f < b.floors; f++) {
    const zMid = f * FH + FH * 0.55;
    for (let i = 1; i <= winN; i++) {
      if (f === 0 && i === 1) continue; // door slot
      windows.push({ cx: slotW * i, cz: zMid });
    }
  }
  const doorCX = slotW;

  const STROKE = 'rgba(15,23,42,0.75)';
  const SW = 1.1;

  return (
    <div style={{ position: 'relative', width: '100%', height: 220 }}>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        width="100%" height="100%"
        preserveAspectRatio="xMidYMax meet"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id={`gF-${b.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={shade(wallFront, 10)} />
            <stop offset="1" stopColor={shade(wallFront, -12)} />
          </linearGradient>
          <linearGradient id={`gS-${b.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={shade(wallSide, 8)} />
            <stop offset="1" stopColor={shade(wallSide, -18)} />
          </linearGradient>
          <linearGradient id={`gRF-${b.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={shade(roofFront, 8)} />
            <stop offset="1" stopColor={roofFront} />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse
          cx={proj(W / 2, D / 2, 0).sx}
          cy={proj(W / 2, D / 2, 0).sy + 6}
          rx={W * 0.65}
          ry={D * 0.4}
          fill="rgba(15,23,42,0.18)"
        />

        {/* === DRAW ORDER: back-to-front painter's algorithm === */}

        {/* 1) Back roof pitch (visible sliver above ridge from this angle, but draw first) */}
        <polygon
          points={`${P(0, D, H)} ${P(W, D, H)} ${P(W, D / 2, H + RH)} ${P(0, D / 2, H + RH)}`}
          fill={roofBack} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round"
        />

        {/* 2) Right side wall (rectangle) */}
        <polygon
          points={`${P(W, 0, 0)} ${P(W, D, 0)} ${P(W, D, H)} ${P(W, 0, H)}`}
          fill={`url(#gS-${b.id})`} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round"
        />
        {/* 2b) Right gable triangle on top of right wall */}
        <polygon
          points={`${P(W, 0, H)} ${P(W, D, H)} ${P(W, D / 2, H + RH)}`}
          fill={`url(#gS-${b.id})`} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round"
        />

        {/* 3) Front wall */}
        <polygon
          points={`${P(0, 0, 0)} ${P(W, 0, 0)} ${P(W, 0, H)} ${P(0, 0, H)}`}
          fill={`url(#gF-${b.id})`} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round"
        />

        {/* 4) Floor divider for 2-story */}
        {b.floors === 2 && (
          <line
            x1={proj(0, 0, FH).sx} y1={proj(0, 0, FH).sy}
            x2={proj(W, 0, FH).sx} y2={proj(W, 0, FH).sy}
            stroke="rgba(15,23,42,0.3)" strokeWidth="0.8" strokeDasharray="3 2"
          />
        )}

        {/* 5) Door */}
        <polygon
          points={`${P(doorCX - doorW / 2, 0, 0)} ${P(doorCX + doorW / 2, 0, 0)} ${P(doorCX + doorW / 2, 0, doorH)} ${P(doorCX - doorW / 2, 0, doorH)}`}
          fill={shade(b.roofColor, -25)} stroke={STROKE} strokeWidth="0.8"
        />
        <circle
          cx={proj(doorCX + doorW / 2 - 1.5, 0, doorH / 2).sx}
          cy={proj(doorCX + doorW / 2 - 1.5, 0, doorH / 2).sy}
          r="0.9" fill="#FFD700"
        />

        {/* 6) Windows on front wall */}
        {windows.map((w, i) => {
          const x1 = w.cx - winW / 2, x2 = w.cx + winW / 2;
          const z1 = w.cz - winH / 2, z2 = w.cz + winH / 2;
          return (
            <g key={i}>
              <polygon
                points={`${P(x1, 0, z1)} ${P(x2, 0, z1)} ${P(x2, 0, z2)} ${P(x1, 0, z2)}`}
                fill="#9DCEEC" stroke={STROKE} strokeWidth="0.8"
              />
              <line
                x1={proj((x1 + x2) / 2, 0, z1).sx} y1={proj((x1 + x2) / 2, 0, z1).sy}
                x2={proj((x1 + x2) / 2, 0, z2).sx} y2={proj((x1 + x2) / 2, 0, z2).sy}
                stroke="rgba(255,255,255,0.85)" strokeWidth="0.6"
              />
              <line
                x1={proj(x1, 0, (z1 + z2) / 2).sx} y1={proj(x1, 0, (z1 + z2) / 2).sy}
                x2={proj(x2, 0, (z1 + z2) / 2).sx} y2={proj(x2, 0, (z1 + z2) / 2).sy}
                stroke="rgba(255,255,255,0.85)" strokeWidth="0.6"
              />
            </g>
          );
        })}

        {/* 7) Window on right side gable too (small) */}
        {b.floors === 2 && (() => {
          const wx = D / 2, wz = H + RH * 0.4;
          const ww = 6, wh = 7;
          return (
            <polygon
              points={`${P(W, wx - ww / 2, wz - wh / 2)} ${P(W, wx + ww / 2, wz - wh / 2)} ${P(W, wx + ww / 2, wz + wh / 2)} ${P(W, wx - ww / 2, wz + wh / 2)}`}
              fill="#9DCEEC" stroke={STROKE} strokeWidth="0.8"
            />
          );
        })()}

        {/* 8) Front roof pitch (drawn LAST so it sits on top) — no weird overhang */}
        <polygon
          points={`${P(0, 0, H)} ${P(W, 0, H)} ${P(W, D / 2, H + RH)} ${P(0, D / 2, H + RH)}`}
          fill={`url(#gRF-${b.id})`} stroke={STROKE} strokeWidth={SW} strokeLinejoin="round"
        />

        {/* 9) Ridge accent */}
        <line
          x1={proj(0, D / 2, H + RH).sx} y1={proj(0, D / 2, H + RH).sy}
          x2={proj(W, D / 2, H + RH).sx} y2={proj(W, D / 2, H + RH).sy}
          stroke={shade(b.roofColor, -45)} strokeWidth="1.4"
        />

        {/* 10) Eave shadow line under front roof on front wall */}
        <line
          x1={proj(0, 0, H).sx} y1={proj(0, 0, H).sy}
          x2={proj(W, 0, H).sx} y2={proj(W, 0, H).sy}
          stroke="rgba(15,23,42,0.3)" strokeWidth="0.8"
        />
      </svg>

      {/* Status pin */}
      <div style={{
        position: 'absolute',
        top: 8, right: 8,
        background: STATUS_COLOR[b.status],
        color: 'white',
        padding: '4px 10px',
        borderRadius: 50,
        fontSize: '0.72rem',
        fontWeight: 800,
        boxShadow: `0 4px 10px ${STATUS_COLOR[b.status]}50`,
      }}>
        {b.status}
      </div>
    </div>
  );
}
