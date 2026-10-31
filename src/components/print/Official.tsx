import type { CSSProperties, ReactNode } from 'react';
import { SCHOOL_NAME, SCHOOL_AFFILIATION } from '../../config/siteLinks';
import type { Signer } from './officialStyles';

// Shared building blocks for printed school documents. Printed output follows Thai official
// document conventions: black text on white, TH Sarabun New, black-ruled tables, grey shading
// only where a cell must stand out (holidays, totals), signature blocks at the end.
// Global print rules for `.official-doc` live in src/index.css; shared table styles and
// signers live in ./officialStyles.ts.


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
