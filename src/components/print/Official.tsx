import type { CSSProperties, ReactNode } from 'react';
import { SCHOOL_NAME, SCHOOL_AFFILIATION, DIRECTOR_NAME, DIRECTOR_POSITION } from '../../config/siteLinks';

// Shared building blocks for printed school documents. Printed output follows Thai official
// document conventions: black text on white, TH Sarabun New, black-ruled tables, grey shading
// only where a cell must stand out (holidays, totals), signature blocks at the end.
// Global print rules for `.official-doc` live in src/index.css.

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

/** "2026-10-30" -> "30 ตุลาคม พ.ศ. 2569" */
export function thaiDateLong(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  return `${d ? `${d} ` : ''}${THAI_MONTHS[m - 1]} พ.ศ. ${y + 543}`;
}

export function OfficialDocument({ children, landscape = false, style }: {
  children: ReactNode;
  landscape?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={`official-doc print-area${landscape ? ' official-landscape' : ''}`} style={style}>
      {children}
    </div>
  );
}

/** Logo, document title, school and affiliation, then any extra lines (class, month, ...). */
export function OfficialHeader({ title, lines = [], showLogo = true }: {
  title: ReactNode;
  lines?: ReactNode[];
  showLogo?: boolean;
}) {
  return (
    <div className="official-header">
      {showLogo && (
        <img
          src={`${import.meta.env.BASE_URL}images/school-logo.png`}
          alt="ตราโรงเรียน"
          className="official-logo"
        />
      )}
      <div className="official-title">{title}</div>
      <div className="official-subtitle">{SCHOOL_NAME} {SCHOOL_AFFILIATION}</div>
      {lines.map((line, i) => <div key={i} className="official-line">{line}</div>)}
    </div>
  );
}

export interface Signer {
  role: string;          // e.g. "ผู้บันทึก", "ผู้ตรวจสอบ"
  name?: string;         // blank line when unknown, filled in by hand
  position?: string;
}

export const DIRECTOR_SIGNER: Signer = { role: 'ผู้อำนวยการสถานศึกษา', name: DIRECTOR_NAME, position: DIRECTOR_POSITION };

/** Signature lines in up to three columns; the last signer is usually the director. */
export function SignatureBlock({ signers }: { signers: Signer[] }) {
  return (
    <div className="official-signatures" style={{ gridTemplateColumns: `repeat(${Math.min(signers.length, 3)}, 1fr)` }}>
      {signers.map((s, i) => (
        <div key={i} className="official-signer">
          <div>ลงชื่อ ........................................ {s.role}</div>
          <div>({s.name || '........................................'})</div>
          {s.position && <div>{s.position}</div>}
          <div>วันที่ ........ /................../..........</div>
        </div>
      ))}
    </div>
  );
}

/** Black-ruled table cell styles; use `shade` for cells that must stand out in black and white. */
export const officialTh: CSSProperties = {
  border: '1px solid #000', padding: '2px 4px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle',
};
export const officialTd: CSSProperties = {
  border: '1px solid #000', padding: '1px 4px', textAlign: 'center', verticalAlign: 'middle',
};
export const officialTdLeft: CSSProperties = { ...officialTd, textAlign: 'left' };
export const SHADE = '#D9D9D9';
