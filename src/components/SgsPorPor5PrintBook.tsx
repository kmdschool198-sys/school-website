import type { CSSProperties, ReactNode } from 'react';
import type { AcademicStudentRecord, AcademicSubject, ClassAcademicData, StudentSubjectScore } from '../data/academicData';
import { scoreScheme } from '../data/academicData';
import { LEVEL_LABELS, READ_ITEMS, TRAIT_ITEMS, fitDetail, type SubjectPlan, type TermPlan } from '../utils/assessment';
import { DIRECTOR_NAME, DIRECTOR_POSITION, SCHOOL_AFFILIATION, SCHOOL_NAME } from '../config/siteLinks';
import { SHADE } from './print/officialStyles';

// ปพ.5 laid out the way SGS prints it, in the school's official document style (TH Sarabun New,
// black-ruled tables, no colour). Only what teachers actually entered is printed: indicator
// columns come from the subject's full-mark plan and the marks saved against it, never from a
// split of the coursework total, and time is the hours on record, not invented daily ticks.
// Anything not entered prints as "-".

/** Paper rules for this book: A4 portrait, one section per page, wide tables on a landscape page. */
export const SGS_PP5_PRINT_STYLES = `
  /* Sarabun is the open edition of TH Sarabun New and is loaded as a web font, so the book prints
     the same on every computer; its sizes here match TH Sarabun New 16pt (body) and 20pt (title). */
  .sgs-book, .sgs-book * { font-family: 'Sarabun', 'TH Sarabun New', 'TH SarabunPSK', sans-serif !important; color: #000; }
  .sgs-book { font-size: 12pt; line-height: 1.3; }
  .sgs-sheet {
    width: 210mm;
    min-height: 296mm;
    margin: 0 auto 24px;
    padding: 12mm 14mm;
    box-sizing: border-box;
    background: #fff;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    page-break-after: always;
    break-after: page;
  }
  .sgs-sheet:last-child { page-break-after: auto; break-after: auto; }
  .sgs-landscape { width: 297mm; min-height: 206mm; }
  .sgs-table { width: 100%; border-collapse: collapse; }
  .sgs-table th, .sgs-table td { border: 1px solid #000; padding: 1px 3px; text-align: center; vertical-align: middle; line-height: 1.3; }
  .sgs-table th { font-weight: 700; }
  .sgs-table td.left { text-align: left; }
  .sgs-table .shade { background: ${SHADE}; }
  .sgs-section-title { font-size: 12pt; font-weight: 700; text-align: center; }
  .sgs-section-sub { font-size: 10.5pt; text-align: center; margin-bottom: 4pt; }
  .sgs-note { font-size: 9pt; margin-top: 3pt; }
  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    @page sgs-landscape { size: A4 landscape; margin: 10mm; }
    .sgs-sheet { width: 100% !important; min-height: auto !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
    .sgs-landscape { page: sgs-landscape; }
    .no-print { display: none !important; }
  }
`;

/** A subject plan has indicator columns only when at least one S-column or the midterm is set. */
const hasIndicators = (tp: TermPlan | undefined) => !!tp && (tp.before.length > 0 || tp.after.length > 0 || tp.midterm > 0);

/** Columns of one term in SGS order: S1-S9, กลางภาค, S10-S18 */
function termColumns(tp: TermPlan) {
  return [
    ...tp.before.map((full, i) => ({ key: `b${i}`, label: `S${i + 1}`, full })),
    ...(tp.midterm > 0 ? [{ key: 'mid', label: 'กลางภาค', full: tp.midterm }] : []),
    ...tp.after.map((full, i) => ({ key: `a${i}`, label: `S${10 + i}`, full })),
  ];
}

const dash = (v: number | null | undefined) => (typeof v === 'number' ? fmt(v) : '-');
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const level = (v: number | null | undefined) => (typeof v === 'number' ? LEVEL_LABELS[Math.max(0, Math.min(3, Math.round(v)))] : '-');

const GRADES = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส'] as const;

export default function SgsPorPor5PrintBook({
  currentClass,
  currentSubject,
  semesterLabel,
  plan,
  measurementHeadName,
  deputyDirectorName,
}: {
  currentClass: ClassAcademicData;
  currentSubject: AcademicSubject;
  semesterLabel: string;
  plan?: SubjectPlan;
  measurementHeadName?: string;
  deputyDirectorName?: string;
}) {
  const scheme = scoreScheme(currentClass.level);
  const students = currentClass.students;
  const scoreOf = (st: AcademicStudentRecord): StudentSubjectScore | undefined => st.scores[currentSubject.code];
  const terms = scheme.yearly ? 2 : 1;

  // ── สรุปผลการเรียน (original results; ผลแก้ตัว is shown on the score page) ──
  const counts = Object.fromEntries(GRADES.map(g => [g, 0])) as Record<string, number>;
  let notGraded = 0;
  for (const st of students) {
    const g = scoreOf(st)?.grade || '';
    if (g in counts) counts[g]++;
    else notGraded++;
  }
  const total = students.length;
  const pct = (n: number) => (total ? ((n / total) * 100).toFixed(2) : '0.00');

  const levelCounts = (pick: (sc: StudentSubjectScore | undefined) => number | undefined) => {
    const c = [0, 0, 0, 0];
    let none = 0;
    for (const st of students) {
      const v = pick(scoreOf(st));
      if (typeof v === 'number') c[Math.max(0, Math.min(3, Math.round(v)))]++;
      else none++;
    }
    return { c, none };
  };
  const traitSummary = levelCounts(sc => sc?.traitScore);
  const readSummary = levelCounts(sc => sc?.readThinkScore);

  const weightLabel = scheme.yearly ? `น้ำหนัก ${currentSubject.credits}` : `${currentSubject.credits} หน่วยกิต`;
  const advisers = currentClass.homeroomTeachers.join(', ');

  return (
    <div className="official-doc sgs-book">
      <style>{SGS_PP5_PRINT_STYLES}</style>

      {/* ═════ หน้า 1: ปก + สรุปผล + การอนุมัติผลการเรียน ═════ */}
      <div className="sgs-sheet">
        <div style={{ textAlign: 'center' }}>
          <img src={`${import.meta.env.BASE_URL}images/school-logo.png`} alt="ตราโรงเรียน" style={{ width: '2cm', height: '2cm', objectFit: 'contain' }} />
          <div style={{ fontSize: '15pt', fontWeight: 700 }}>แบบบันทึกผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)</div>
          <div style={{ fontSize: '12pt', fontWeight: 700 }}>{SCHOOL_NAME}</div>
          <div style={{ fontSize: '12pt' }}>{SCHOOL_AFFILIATION}</div>
          <div style={{ fontSize: '12pt' }}>{semesterLabel}</div>
        </div>

        <table className="sgs-table" style={{ fontSize: '11.5pt', marginTop: '6pt' }}>
          <tbody>
            <InfoRow label="กลุ่มสาระการเรียนรู้" value={currentSubject.group} />
            <InfoRow label="รหัสวิชา / รายวิชา" value={`${currentSubject.code} ${currentSubject.name} (${currentSubject.type})`} />
            <InfoRow label="ชั้น" value={`${currentClass.className} (${currentClass.shortName}/${currentClass.room})`} />
            <InfoRow label="น้ำหนัก / เวลาเรียน" value={`${weightLabel} · ${currentSubject.hours} ชั่วโมง${scheme.yearly ? '/ปี' : '/ภาคเรียน'}`} />
            <InfoRow label="ครูผู้สอน" value={currentSubject.teacher} />
            <InfoRow label="ครูที่ปรึกษา" value={advisers || '-'} />
          </tbody>
        </table>

        <div style={{ fontSize: '12pt', fontWeight: 700, marginTop: '8pt' }}>สรุปผลการเรียน</div>
        <table className="sgs-table" style={{ fontSize: '10.5pt' }}>
          <thead>
            <tr>
              <th rowSpan={2}>จำนวนนักเรียน</th>
              <th colSpan={GRADES.length + (notGraded ? 1 : 0)}>จำนวนนักเรียนที่ได้ระดับผลการเรียน</th>
            </tr>
            <tr>
              {GRADES.map(g => <th key={g} style={{ width: '7.5%' }}>{g}</th>)}
              {notGraded > 0 && <th>ยังไม่ตัดสิน</th>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{total}</td>
              {GRADES.map(g => <td key={g}>{counts[g]}</td>)}
              {notGraded > 0 && <td>{notGraded}</td>}
            </tr>
            <tr>
              <td>ร้อยละ</td>
              {GRADES.map(g => <td key={g}>{pct(counts[g])}</td>)}
              {notGraded > 0 && <td>{pct(notGraded)}</td>}
            </tr>
          </tbody>
        </table>
        {notGraded > 0 && scheme.yearly && (
          <div className="sgs-note">หมายเหตุ ระดับประถมศึกษาตัดสินผลการเรียนเมื่อครบทั้งปี (ภาคเรียนที่ 1 + 2)</div>
        )}

        <table className="sgs-table" style={{ fontSize: '10.5pt', marginTop: '6pt' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: '34%' }}>ผลการประเมิน</th>
              <th colSpan={4}>จำนวนนักเรียน</th>
            </tr>
            <tr>
              {['ดีเยี่ยม', 'ดี', 'ผ่าน', 'ไม่ผ่าน'].map(l => <th key={l}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="left">คุณลักษณะอันพึงประสงค์</td>
              {[3, 2, 1, 0].map(l => <td key={l}>{traitSummary.c[l]}</td>)}
            </tr>
            <tr>
              <td className="left">การอ่าน คิดวิเคราะห์ และเขียน</td>
              {[3, 2, 1, 0].map(l => <td key={l}>{readSummary.c[l]}</td>)}
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '12pt', fontWeight: 700, marginTop: '10pt', textAlign: 'center' }}>การอนุมัติผลการเรียน</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10pt 18pt', fontSize: '11.5pt', marginTop: '6pt', breakInside: 'avoid' }}>
          <Sign role="ครูผู้สอน" name={currentSubject.teacher} />
          <Sign role="หัวหน้ากลุ่มสาระการเรียนรู้" />
          <Sign role="หัวหน้างานวัดผลและประเมินผล" name={measurementHeadName} />
          <Sign role="รองผู้อำนวยการฝ่ายวิชาการ" name={deputyDirectorName} note="[  ] เห็นควรอนุมัติ   [  ] ไม่เห็นควรอนุมัติ" />
        </div>
        <div style={{ textAlign: 'center', fontSize: '11.5pt', marginTop: '12pt', breakInside: 'avoid' }}>
          <div>[  ] อนุมัติ &nbsp;&nbsp;&nbsp;&nbsp; [  ] ไม่อนุมัติ</div>
          <div style={{ marginTop: '14pt' }}>ลงชื่อ ................................................................</div>
          <div>({DIRECTOR_NAME})</div>
          <div>{DIRECTOR_POSITION}</div>
          <div>วันที่ ........ เดือน .............................. พ.ศ. ..........</div>
        </div>
      </div>

      {/* ═════ บันทึกผลการเรียนรู้ตามตัวชี้วัด (one page per term) ═════ */}
      {Array.from({ length: terms }, (_, term) => (
        <ScoreSheet
          key={term}
          term={term}
          terms={terms}
          tp={plan?.[term]}
          currentClass={currentClass}
          currentSubject={currentSubject}
          semesterLabel={semesterLabel}
          scoreOf={scoreOf}
        />
      ))}

      {/* ═════ ประถม: สรุปผลทั้งปี ═════ */}
      {scheme.yearly && (
        <div className="sgs-sheet">
          <SheetHeading title="สรุปผลการเรียนตลอดปีการศึกษา" currentClass={currentClass} currentSubject={currentSubject} semesterLabel={semesterLabel} />
          <table className="sgs-table" style={{ fontSize: '10.5pt' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '6%' }}>เลขที่</th>
                <th rowSpan={2} style={{ width: '10%' }}>เลขประจำตัว</th>
                <th rowSpan={2}>ชื่อ - สกุล</th>
                <th colSpan={3}>ภาคเรียนที่ 1</th>
                <th colSpan={3}>ภาคเรียนที่ 2</th>
                <th rowSpan={2}>รวม<br />(100)</th>
                <th rowSpan={2}>ผลการ<br />เรียน</th>
                <th rowSpan={2}>ผลการ<br />แก้ตัว</th>
              </tr>
              <tr>
                <th>ระหว่างภาค<br />({scheme.courseworkMax})</th><th>ปลายภาค<br />({scheme.finalMax})</th><th>รวม<br />(50)</th>
                <th>ระหว่างภาค<br />({scheme.courseworkMax})</th><th>ปลายภาค<br />({scheme.finalMax})</th><th>รวม<br />(50)</th>
              </tr>
            </thead>
            <tbody>
              {students.map(st => {
                const sc = scoreOf(st);
                const t1 = sc ? (sc.coursework ?? 0) + (sc.finalExam ?? 0) : undefined;
                const hasT2 = sc?.term2Coursework !== undefined || sc?.term2FinalExam !== undefined;
                const t2 = hasT2 ? (sc?.term2Coursework ?? 0) + (sc?.term2FinalExam ?? 0) : undefined;
                return (
                  <tr key={st.code}>
                    <td>{st.no}</td>
                    <td>{st.code}</td>
                    <td className="left">{st.name}</td>
                    <td>{dash(sc?.coursework)}</td>
                    <td>{dash(sc?.finalExam)}</td>
                    <td>{dash(t1)}</td>
                    <td>{dash(sc?.term2Coursework)}</td>
                    <td>{dash(sc?.term2FinalExam)}</td>
                    <td>{dash(t2)}</td>
                    <td>{hasT2 ? dash(sc?.total) : '-'}</td>
                    <td>{sc?.grade || '-'}</td>
                    <td>{sc?.remedial?.grade || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═════ บันทึกเวลาเรียน ═════ */}
      <div className="sgs-sheet">
        <SheetHeading title="บันทึกเวลาเรียน" currentClass={currentClass} currentSubject={currentSubject} semesterLabel={semesterLabel} />
        <table className="sgs-table" style={{ fontSize: '10.5pt' }}>
          <thead>
            <tr>
              <th style={{ width: '7%' }}>เลขที่</th>
              <th style={{ width: '12%' }}>เลขประจำตัว</th>
              <th>ชื่อ - สกุล</th>
              <th style={{ width: '12%' }}>เวลาเรียนเต็ม<br />(ชั่วโมง)</th>
              <th style={{ width: '12%' }}>มาเรียน<br />(ชั่วโมง)</th>
              <th style={{ width: '10%' }}>ร้อยละ</th>
              <th style={{ width: '13%' }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {students.map(st => {
              const sc = scoreOf(st);
              const hours = currentSubject.hours;
              const came = sc?.attendedHours;
              const p = typeof came === 'number' && hours > 0 ? (came / hours) * 100 : null;
              return (
                <tr key={st.code}>
                  <td>{st.no}</td>
                  <td>{st.code}</td>
                  <td className="left">{st.name}</td>
                  <td>{hours}</td>
                  <td>{dash(came)}</td>
                  <td>{p === null ? '-' : p.toFixed(2)}</td>
                  <td className={p !== null && p < 80 ? 'shade' : undefined}>{p !== null && p < 80 ? 'ไม่มีสิทธิ์สอบ (มส)' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="sgs-note">ผู้เรียนต้องมีเวลาเรียนไม่น้อยกว่าร้อยละ 80 ของเวลาเรียนทั้งหมด จึงมีสิทธิ์รับการประเมินผลปลายภาค</div>
      </div>

      {/* ═════ คุณลักษณะอันพึงประสงค์ + การอ่าน คิดวิเคราะห์ และเขียน ═════ */}
      <div className="sgs-sheet">
        <SheetHeading title="ผลการประเมินคุณลักษณะอันพึงประสงค์ และการอ่าน คิดวิเคราะห์ และเขียน" currentClass={currentClass} currentSubject={currentSubject} semesterLabel={semesterLabel} />
        <ItemTable
          heading="คุณลักษณะอันพึงประสงค์"
          items={TRAIT_ITEMS}
          students={students}
          itemsOf={st => scoreOf(st)?.traitItems}
          overallOf={st => scoreOf(st)?.traitScore}
        />
        <div style={{ height: '8pt' }} />
        <ItemTable
          heading="การอ่าน คิดวิเคราะห์ และเขียน"
          items={READ_ITEMS}
          students={students}
          itemsOf={st => scoreOf(st)?.readItems}
          overallOf={st => scoreOf(st)?.readThinkScore}
        />
        <div className="sgs-note">เกณฑ์ 3 = ดีเยี่ยม · 2 = ดี · 1 = ผ่าน · 0 = ไม่ผ่าน &nbsp;|&nbsp; "-" = ยังไม่ได้บันทึกผลรายข้อ (ใช้ผลประเมินรวมที่ครูบันทึก)</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <th style={{ width: '30%', textAlign: 'left', fontWeight: 700 }}>{label}</th>
      <td className="left">{value}</td>
    </tr>
  );
}

function Sign({ role, name, note }: { role: string; name?: string; note?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {note && <div>{note}</div>}
      <div style={{ marginTop: '10pt' }}>ลงชื่อ ................................................</div>
      <div>({name || '................................................'})</div>
      <div>{role}</div>
    </div>
  );
}

function SheetHeading({ title, currentClass, currentSubject, semesterLabel }: {
  title: string;
  currentClass: ClassAcademicData;
  currentSubject: AcademicSubject;
  semesterLabel: string;
}) {
  return (
    <>
      <div className="sgs-section-title">{title}</div>
      <div className="sgs-section-sub">
        {SCHOOL_NAME} · {semesterLabel} · ชั้น{currentClass.className} · {currentSubject.code} {currentSubject.name} · ครูผู้สอน {currentSubject.teacher}
      </div>
    </>
  );
}

function ScoreSheet({ term, terms, tp, currentClass, currentSubject, semesterLabel, scoreOf }: {
  term: number;
  terms: number;
  tp?: TermPlan;
  currentClass: ClassAcademicData;
  currentSubject: AcademicSubject;
  semesterLabel: string;
  scoreOf: (st: AcademicStudentRecord) => StudentSubjectScore | undefined;
}) {
  const scheme = scoreScheme(currentClass.level);
  const indicators = hasIndicators(tp) ? termColumns(tp!) : [];
  // more than 10 marks columns no longer fit A4 portrait legibly
  const landscape = indicators.length > 10;
  const cwKey = term === 0 ? 'coursework' : 'term2Coursework';
  const finKey = term === 0 ? 'finalExam' : 'term2FinalExam';
  const termMax = scheme.courseworkMax + scheme.finalMax;
  const title = `บันทึกผลการเรียนรู้ตามตัวชี้วัด${terms > 1 ? ` ภาคเรียนที่ ${term + 1}` : ''}`;
  const cell: CSSProperties = indicators.length > 14 ? { fontSize: '8.5pt' } : { fontSize: '10pt' };

  return (
    <div className={`sgs-sheet${landscape ? ' sgs-landscape' : ''}`}>
      <SheetHeading title={title} currentClass={currentClass} currentSubject={currentSubject} semesterLabel={semesterLabel} />
      <table className="sgs-table" style={cell}>
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '4%' }}>เลขที่</th>
            <th rowSpan={2} style={{ width: '8%' }}>เลข<br />ประจำตัว</th>
            <th rowSpan={2} style={{ minWidth: '38mm' }}>ชื่อ - สกุล</th>
            {indicators.map(c => <th key={c.key}>{c.label}</th>)}
            <th>ระหว่าง<br />ภาค</th>
            <th>ปลาย<br />ภาค</th>
            <th>รวม</th>
            <th rowSpan={2}>ผลการ<br />เรียน</th>
            <th rowSpan={2}>ผลการ<br />แก้ตัว</th>
          </tr>
          <tr>
            {indicators.map(c => <th key={c.key} className="shade">{c.full}</th>)}
            <th className="shade">{scheme.courseworkMax}</th>
            <th className="shade">{tp?.final ?? scheme.finalMax}</th>
            <th className="shade">{termMax}</th>
          </tr>
        </thead>
        <tbody>
          {currentClass.students.map(st => {
            const sc = scoreOf(st);
            const d = tp && sc?.detail?.[term] ? fitDetail(sc.detail[term], tp) : undefined;
            const cw = sc?.[cwKey] as number | undefined;
            const fin = sc?.[finKey] as number | undefined;
            const entered = typeof cw === 'number' || typeof fin === 'number';
            const sum = entered ? (cw ?? 0) + (fin ?? 0) : undefined;
            // มัธยม grades each semester; ประถม grades the year, shown on the year summary page
            const grade = scheme.yearly ? '' : (sc?.grade || '');
            return (
              <tr key={st.code}>
                <td>{st.no}</td>
                <td>{st.code}</td>
                <td className="left">{st.name}</td>
                {indicators.map(c => {
                  const v = !d ? null
                    : c.key === 'mid' ? d.midterm
                      : (c.key[0] === 'b' ? d.before : d.after)[Number(c.key.slice(1))];
                  return <td key={c.key}>{dash(v)}</td>;
                })}
                <td>{dash(cw)}</td>
                <td>{dash(fin)}</td>
                <td style={{ fontWeight: 700 }}>{dash(sum)}</td>
                <td style={{ fontWeight: 700 }}>{scheme.yearly ? (term === terms - 1 ? (sc?.grade || '-') : '') : (grade || '-')}</td>
                <td>{sc?.remedial ? `${sc.remedial.grade} (${sc.remedial.type})` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!indicators.length && (
        <div className="sgs-note">รายวิชานี้ยังไม่ได้กำหนดคะแนนเต็มรายตัวชี้วัด (S1–S18) จึงพิมพ์เฉพาะคะแนนระหว่างภาค ปลายภาค และผลการเรียน</div>
      )}
    </div>
  );
}

function ItemTable({ heading, items, students, itemsOf, overallOf }: {
  heading: string;
  items: readonly string[];
  students: AcademicStudentRecord[];
  itemsOf: (st: AcademicStudentRecord) => (number | null)[] | undefined;
  overallOf: (st: AcademicStudentRecord) => number | undefined;
}) {
  return (
    <table className="sgs-table" style={{ fontSize: '9.5pt' }}>
      <thead>
        <tr>
          <th rowSpan={2} style={{ width: '5%' }}>เลขที่</th>
          <th rowSpan={2} style={{ width: '25%' }}>ชื่อ - สกุล</th>
          <th colSpan={items.length}>{heading} (รายข้อ)</th>
          <th rowSpan={2} style={{ width: '8%' }}>ระดับ</th>
          <th rowSpan={2} style={{ width: '10%' }}>ผลการ<br />ประเมิน</th>
        </tr>
        <tr>
          {items.map((label, i) => <th key={label} style={{ fontSize: '8pt', fontWeight: 700 }}>{i + 1}. {label}</th>)}
        </tr>
      </thead>
      <tbody>
        {students.map(st => {
          const marks = itemsOf(st);
          const overall = overallOf(st);
          return (
            <tr key={st.code}>
              <td>{st.no}</td>
              <td className="left">{st.name}</td>
              {items.map((label, i) => <td key={label}>{dash(marks?.[i])}</td>)}
              <td>{dash(overall)}</td>
              <td>{level(overall)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
