import { useState } from 'react';
import type { AcademicStudentRecord, ScoreScheme, StudentSubjectScore } from '../../data/academicData';
import { courseworkFromDetail, detailHasMarks, fitDetail, type SubjectPlan, type TermDetail } from '../../utils/assessment';
import { parseClipboardTable, cleanNumeric, isTabularPaste } from '../../utils/excelPaste';

// SGS "บันทึกผลการเรียน": one input per indicator with its full mark above it. Views follow SGS:
// ก่อนกลางภาค (S1-S9 + กลางภาค), หลังกลางภาค (S10-S18 + ปลายภาค) or ตลอดภาค (all).
// Marks above the full mark are cut to it; Enter moves down, Tab across, Ctrl+V pastes a block from Excel.

type View = 'pre' | 'post' | 'all';
type Patch = Partial<Pick<StudentSubjectScore, 'detail' | 'finalExam' | 'term2FinalExam'>>;

interface Column { key: string; label: string; full: number; half: 'pre' | 'post' }

export default function IndicatorGrid({ students, subjectCode, scheme, plan, term, locked, onSave }: {
  students: AcademicStudentRecord[];
  subjectCode: string;
  scheme: ScoreScheme;
  plan: SubjectPlan;
  /** 0 = ภาค 1 (or มัธยม's semester), 1 = ภาค 2 (ประถม) */
  term: number;
  locked: boolean;
  onSave: (studentCode: string, patch: Patch) => void;
}) {
  const [view, setView] = useState<View>('all');
  const tp = plan[term];
  const finalKey = term === 0 ? 'finalExam' : 'term2FinalExam';

  const columns: Column[] = [
    ...tp.before.map((full, i) => ({ key: `b${i}`, label: `S${i + 1}`, full, half: 'pre' as const })),
    ...(tp.midterm > 0 ? [{ key: 'mid', label: 'กลางภาค', full: tp.midterm, half: 'pre' as const }] : []),
    ...tp.after.map((full, i) => ({ key: `a${i}`, label: `S${10 + i}`, full, half: 'post' as const })),
    { key: 'final', label: 'ปลายภาค', full: tp.final, half: 'post' },
  ];
  const shown = columns.filter(c => view === 'all' || c.half === view);

  const detailOf = (st: AcademicStudentRecord) => fitDetail(st.scores[subjectCode]?.detail?.[term], tp);
  const read = (st: AcademicStudentRecord, key: string): number | null => {
    const d = detailOf(st);
    if (key === 'mid') return d.midterm;
    if (key === 'final') return (st.scores[subjectCode]?.[finalKey] as number | undefined) ?? null;
    return (key[0] === 'b' ? d.before : d.after)[Number(key.slice(1))];
  };

  /** Apply several cell changes of one student as one save */
  const saveRow = (st: AcademicStudentRecord, cells: { key: string; value: number | null }[]) => {
    const d: TermDetail = detailOf(st);
    const patch: Patch = {};
    for (const { key, value } of cells) {
      if (key === 'final') {
        // a blank term-2 final stays unentered; ภาค 1 / มัธยม final is a number like before
        if (value !== null || term === 0) patch[finalKey] = value ?? 0;
      }
      else if (key === 'mid') d.midterm = value;
      else (key[0] === 'b' ? d.before : d.after)[Number(key.slice(1))] = value;
    }
    if (cells.some(c => c.key !== 'final')) {
      // keep the other term's marks as they are; a term never entered stays an empty plan-shaped record
      const all = plan.map((p, i) => (i === term ? fitDetail(d, tp) : fitDetail(st.scores[subjectCode]?.detail?.[i], p)));
      patch.detail = all;
    }
    onSave(st.code, patch);
  };

  const clamp = (col: Column, v: number) => Math.max(0, Math.min(col.full, v));

  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(`input[data-ind-row="${row}"][data-ind-col="${col}"]`);
    if (el) { el.focus(); el.select(); }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) => {
    const text = e.clipboardData.getData('text');
    if (!isTabularPaste(text)) return;
    e.preventDefault();
    parseClipboardTable(text).forEach((cells, r) => {
      const st = students[row + r];
      if (!st) return;
      const changes = cells.flatMap((cell, c) => {
        const column = shown[col + c];
        const v = cleanNumeric(cell);
        return column && v !== null ? [{ key: column.key, value: clamp(column, v) }] : [];
      });
      if (changes.length) saveRow(st, changes);
    });
  };

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #E2E8F0' }}>
        {([['pre', 'ก่อนกลางภาค'], ['post', 'หลังกลางภาค'], ['all', 'ตลอดภาค']] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
            style={{ border: 'none', borderRadius: 999, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', background: view === v ? '#0369A1' : '#F1F5F9', color: view === v ? 'white' : '#0F172A' }}>
            {label}
          </button>
        ))}
        <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: 6 }}>
          ตัวเลขใต้หัวคอลัมน์ = คะแนนเต็ม · กรอกเกินไม่ได้ · วางจาก Excel ได้หลายช่อง · เมื่อกรอกตัวชี้วัดของนักเรียนคนใด คะแนนระหว่างเรียนเดิมของคนนั้นจะคำนวณจากตัวชี้วัดแทน
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#1E293B', color: 'white' }}>
              <th style={{ ...th, width: 48 }}>เลขที่</th>
              <th style={{ ...th, textAlign: 'left', minWidth: 180 }}>ชื่อ-นามสกุล</th>
              {shown.map(c => (
                <th key={c.key} style={{ ...th, minWidth: 64, background: c.key === 'final' || c.key === 'mid' ? '#075985' : '#0369A1' }}>
                  {c.label}<div style={{ fontWeight: 600, opacity: 0.9 }}>{c.full}</div>
                </th>
              ))}
              <th style={{ ...th, background: '#0F172A' }}>ระหว่างเรียน<div style={{ fontWeight: 600, opacity: 0.9 }}>{scheme.courseworkMax}</div></th>
              <th style={{ ...th, background: '#0F172A' }}>{scheme.yearly ? 'รวมทั้งปี' : 'รวม'}<div style={{ fontWeight: 600, opacity: 0.9 }}>100</div></th>
              <th style={{ ...th, background: '#15803D' }}>เกรด</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st, row) => {
              const sc = st.scores[subjectCode];
              const d = detailOf(st);
              const termCoursework = detailHasMarks(d) ? courseworkFromDetail(d) : (term === 0 ? sc?.coursework : sc?.term2Coursework);
              return (
                <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ ...td, fontWeight: 800 }}>{st.no}</td>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{st.name}</td>
                  {shown.map((c, col) => {
                    const v = read(st, c.key);
                    return (
                      <td key={c.key} style={{ ...td, background: c.half === 'pre' ? '#F0F9FF' : '#F8FAFC' }}>
                        <input
                          type="number" min={0} max={c.full} step="any" inputMode="decimal"
                          value={v ?? ''} disabled={locked}
                          aria-label={`${st.name} ${c.label} เต็ม ${c.full}`}
                          data-ind-row={row} data-ind-col={col}
                          onFocus={e => e.target.select()}
                          onChange={e => saveRow(st, [{ key: c.key, value: e.target.value === '' ? null : clamp(c, Number(e.target.value)) }])}
                          onPaste={e => onPaste(e, row, col)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(row + 1, col); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(row - 1, col); }
                          }}
                          style={cell}
                        />
                      </td>
                    );
                  })}
                  <td style={{ ...td, fontWeight: 800 }}>{termCoursework ?? ''}</td>
                  <td style={{ ...td, fontWeight: 900 }}>{sc?.total ?? ''}</td>
                  <td style={{ ...td, fontWeight: 900, color: sc?.grade === '0' || sc?.grade === 'ร' || sc?.grade === 'มส' ? '#B91C1C' : '#15803D' }}>
                    {sc?.grade || (scheme.yearly ? <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>รอภาค 2</span> : '')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '8px 6px', fontWeight: 800, fontSize: '0.78rem', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' };
const td: React.CSSProperties = { padding: '4px 6px', textAlign: 'center' };
const cell: React.CSSProperties = { width: 58, padding: '6px 4px', borderRadius: 6, border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' };
