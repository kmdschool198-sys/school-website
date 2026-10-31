import type { AcademicStudentRecord, StudentSubjectScore } from '../../data/academicData';
import { LEVEL_LABELS, READ_ITEMS, TRAIT_ITEMS, itemsLevel } from '../../utils/assessment';

// SGS "บันทึกผลการประเมินคุณลักษณะ / การอ่าน คิด วิเคราะห์": a level 0-3 per item for each student.
// The top row sets an item for the whole class in one go; each student can then be changed alone.
// The overall level is the rounded mean of the items (shown at the end of each block).

type ItemsKey = 'traitItems' | 'readItems';
type Patch = Partial<Pick<StudentSubjectScore, ItemsKey>>;

const BLOCKS: { key: ItemsKey; title: string; items: readonly string[]; fallback: 'traitScore' | 'readThinkScore' }[] = [
  { key: 'traitItems', title: 'คุณลักษณะอันพึงประสงค์', items: TRAIT_ITEMS, fallback: 'traitScore' },
  { key: 'readItems', title: 'การอ่าน คิด วิเคราะห์ และเขียน', items: READ_ITEMS, fallback: 'readThinkScore' },
];

export default function ItemsGrid({ students, subjectCode, locked, onSave }: {
  students: AcademicStudentRecord[];
  subjectCode: string;
  locked: boolean;
  onSave: (studentCode: string, patch: Patch) => void;
}) {
  const itemsOf = (st: AcademicStudentRecord, key: ItemsKey, count: number) =>
    Array.from({ length: count }, (_, i) => st.scores[subjectCode]?.[key]?.[i] ?? null);

  const setItem = (st: AcademicStudentRecord, key: ItemsKey, count: number, index: number, value: number | null) => {
    const items = itemsOf(st, key, count);
    items[index] = value;
    onSave(st.code, { [key]: items });
  };

  const setWholeClass = (key: ItemsKey, count: number, index: number, value: number | null) => {
    if (!window.confirm(`ตั้ง${value === null ? 'ค่าว่าง' : ` ระดับ ${value} (${LEVEL_LABELS[value]})`} ให้ทั้งห้องในข้อนี้?`)) return;
    students.forEach(st => setItem(st, key, count, index, value));
  };

  const select = (value: number | null, onChange: (v: number | null) => void, label: string, bold = false) => (
    <select value={value ?? ''} disabled={locked} aria-label={label}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      style={{ ...sel, fontWeight: bold ? 900 : 700, color: value === 0 ? '#B91C1C' : '#0F172A' }}>
      <option value="">-</option>
      {[3, 2, 1, 0].map(l => <option key={l} value={l}>{l}</option>)}
    </select>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: '#1E293B', color: 'white' }}>
            <th rowSpan={2} style={{ ...th, width: 48 }}>เลขที่</th>
            <th rowSpan={2} style={{ ...th, textAlign: 'left', minWidth: 170 }}>ชื่อ-นามสกุล</th>
            {BLOCKS.map(b => <th key={b.key} colSpan={b.items.length + 1} style={th}>{b.title} (0-3)</th>)}
          </tr>
          <tr style={{ background: '#334155', color: 'white' }}>
            {BLOCKS.flatMap(b => [
              ...b.items.map((name, i) => <th key={`${b.key}${i}`} style={{ ...th, minWidth: 62 }} title={name}>{i + 1}. {name.split(' ')[0]}</th>),
              <th key={`${b.key}-sum`} style={{ ...th, background: '#0F172A' }}>สรุป</th>,
            ])}
          </tr>
          <tr className="no-print" style={{ background: '#E0F2FE' }}>
            <td colSpan={2} style={{ ...td, textAlign: 'left', fontWeight: 800, color: '#075985' }}>ตั้งทั้งห้อง</td>
            {BLOCKS.flatMap(b => [
              ...b.items.map((name, i) => (
                <td key={`${b.key}-all${i}`} style={td}>
                  {select(null, v => setWholeClass(b.key, b.items.length, i, v), `ตั้งข้อ ${name} ทั้งห้อง`)}
                </td>
              )),
              <td key={`${b.key}-all-sum`} style={td} />,
            ])}
          </tr>
        </thead>
        <tbody>
          {students.map(st => (
            <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
              <td style={{ ...td, fontWeight: 800 }}>{st.no}</td>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{st.name}</td>
              {BLOCKS.flatMap(b => {
                const items = itemsOf(st, b.key, b.items.length);
                const level = itemsLevel(items) ?? st.scores[subjectCode]?.[b.fallback] ?? null;
                return [
                  ...items.map((v, i) => (
                    <td key={`${b.key}${i}`} style={td}>
                      {select(v, nv => setItem(st, b.key, b.items.length, i, nv), `${st.name} ${b.items[i]}`)}
                    </td>
                  )),
                  <td key={`${b.key}-sum`} style={{ ...td, fontWeight: 900, background: '#F8FAFC', color: level === 0 ? '#B91C1C' : '#0F172A' }}>
                    {level === null ? '-' : `${level} ${LEVEL_LABELS[level]}`}
                  </td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: '7px 5px', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '4px 4px', textAlign: 'center' };
const sel: React.CSSProperties = { padding: '4px 2px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem', minWidth: 48 };
