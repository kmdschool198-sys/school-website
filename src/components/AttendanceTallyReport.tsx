import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { ChevronLeft, LogOut, Download, Sparkles } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from './TeacherLoginGate';
import QuickDate from './QuickDate';
import { daysInMonth, downloadCsvReport, makeSectionedReportRows, monthLabel, yearLabel, THAI_MONTHS_FULL } from '../utils/csvReport';
import { SCHOOL_NAME } from '../config/siteLinks';

// A daily count that comes straight from attendance, with nothing extra for teachers to fill in:
// a student marked "มาเรียน" counts (drank milk, ate lunch, did duty) unless the record was
// flagged otherwise. Used by the milk, brushing, lunch and duty pages.

type ExceptionFlag = 'noMilk' | 'noBrush' | 'noLunch' | 'noDuty';
interface AttRecord { status: string; noMilk?: boolean; noBrush?: boolean; noLunch?: boolean; noDuty?: boolean }
interface AttDoc { classId: string; date: string; records: Record<string, AttRecord>; }
type CsvPeriod = 'month' | 'year';

export interface TallyConfig {
  /** Page heading, e.g. "รายงานการดื่มนม" */
  title: string;
  icon: string;
  color: string;
  colorLight: string;
  flag: ExceptionFlag;
  /** What a counted student did, e.g. "ได้รับนม" */
  countedLabel: string;
  /** Unit for monthly totals, e.g. "กล่อง" */
  unit: string;
  /** Explains the rule in the banner, e.g. <>นักเรียนที่ <b>"มาเรียน"</b> = ได้รับนม</> */
  rule: React.ReactNode;
  printFormType: 'milk' | 'brush' | 'lunch' | 'duty';
  /** Budget per counted student per day (baht), shown when set */
  ratePerHead?: number;
  csvFilePrefix: string;
  extraLink?: { to: string; label: string };
}

const counts = (r: AttRecord | undefined, flag: ExceptionFlag) => !!r && r.status === 'present' && !r[flag];

export default function AttendanceTallyReport({ config }: { config: TallyConfig }) {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title={`${config.icon} ${config.title}`} subtitle="ดึงข้อมูลจากการเช็คชื่ออัตโนมัติ" />;
  return <Report config={config} userName={auth.name} onLogout={auth.logout} />;
}

function Report({ config, userName, onLogout }: { config: TallyConfig; userName: string; onLogout: () => void }) {
  const { title, icon, color, colorLight, flag, countedLabel, unit, ratePerHead } = config;
  const { classes: availableClasses } = useSchoolRoster();
  const [date, setDate] = useState(todayStr());
  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('month');
  const [csvScope, setCsvScope] = useState<string>('all');
  const [allDocs, setAllDocs] = useState<AttDoc[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'attendance'));
        const arr: AttDoc[] = [];
        snap.forEach(d => arr.push(d.data() as AttDoc));
        setAllDocs(arr);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const countDoc = (d: AttDoc) => Object.values(d.records || {}).filter(r => counts(r, flag)).length;

  const totalStudents = availableClasses.reduce((s, c) => s + c.students.length, 0);
  const month = date.slice(0, 7);
  const year = date.slice(0, 4);

  const dayDocs = useMemo(() => allDocs.filter(d => d.date === date), [allDocs, date]);
  const dayPerClass = availableClasses.map(c => {
    const d = dayDocs.find(x => x.classId === c.id);
    return { c, count: d ? countDoc(d) : 0, checked: !!d };
  });
  const dayTotal = dayPerClass.reduce((s, x) => s + x.count, 0);

  const monthPerClass = availableClasses.map(c => {
    const docs = allDocs.filter(d => d.classId === c.id && d.date.startsWith(month));
    return { c, total: docs.reduce((s, d) => s + countDoc(d), 0), days: new Set(docs.map(d => d.date)).size };
  });
  const monthTotal = monthPerClass.reduce((s, x) => s + x.total, 0);

  const historyDates = useMemo(() => Array.from(new Set(allDocs.map(d => d.date))).sort().reverse().slice(0, 30), [allDocs]);

  const exportCsv = () => {
    const targetClasses = csvScope === 'all' ? availableClasses : availableClasses.filter(c => c.id === csvScope);
    const sections = targetClasses.map(classItem => {
      const classDocs = allDocs.filter(d => d.classId === classItem.id);
      const rows = csvPeriod === 'month'
        ? classItem.students.map((student, index) => {
          let yes = 0;
          let no = 0;
          const marks = daysInMonth(month).map(day => {
            const dateText = `${month}-${String(day).padStart(2, '0')}`;
            const record = classDocs.find(d => d.date === dateText)?.records?.[student.id];
            if (!record) return '';
            if (counts(record, flag)) { yes++; return '✓'; }
            no++;
            return '✗';
          });
          return [String(index + 1), student.code || '-', student.name, ...marks, String(yes), String(no)];
        })
        : classItem.students.map((student, index) => {
          const row = [String(index + 1), student.code || '-', student.name];
          let yes = 0;
          let days = 0;
          THAI_MONTHS_FULL.forEach((_, monthIndex) => {
            const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            let mYes = 0;
            let mDays = 0;
            classDocs.filter(d => d.date.startsWith(prefix)).forEach(d => {
              const record = d.records?.[student.id];
              if (!record) return;
              mDays++;
              if (counts(record, flag)) mYes++;
            });
            yes += mYes;
            days += mDays;
            row.push(mDays ? `${mYes}/${mDays}` : '-');
          });
          row.push(String(yes), String(days));
          return row;
        });

      return {
        title: `ชั้น ${classItem.label}`,
        headers: csvPeriod === 'month'
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...daysInMonth(month).map(String), `รวม${countedLabel}`, `รวมไม่ได้${countedLabel.replace(/^ได้/, '')}`]
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m} (${countedLabel}/ทั้งหมด)`), `รวม${countedLabel}`, 'จำนวนวันที่มีข้อมูล'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });
    const reportRows = makeSectionedReportRows({
      title: `${title} ${SCHOOL_NAME}`,
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${targetClasses[0]?.label || '-'}`], ['ผู้ส่งออก', userName], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      sections,
      footerRows: [['คำอธิบาย', csvPeriod === 'month' ? `✓ = ${countedLabel}, ✗ = ขาด/ลา, ช่องว่าง = ยังไม่มีข้อมูล` : `ช่องรายปีแสดงจำนวน${countedLabel}/จำนวนวันที่มีข้อมูล`]],
    });
    const scopeName = csvScope === 'all' ? 'ทุกชั้น' : targetClasses[0]?.label || 'ชั้น';
    downloadCsvReport(`${config.csvFilePrefix}_${scopeName}_${csvPeriod === 'month' ? `รายเดือน_${month}` : `รายปี_${year}`}`, reportRows);
  };

  const baht = (n: number) => `${(n * (ratePerHead || 0)).toLocaleString('th-TH')} บ.`;

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${color},${colorLight})`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{icon} {title}</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>ดึงจากการเช็คชื่ออัตโนมัติ · {userName}</div>
          </div>
          <Link to={`/print-form/${config.printFormType}`} style={{ ...btnLogout, textDecoration: 'none' }}>🖨️ พิมพ์ฟอร์ม</Link>
          {config.extraLink && <Link to={config.extraLink.to} style={{ ...btnLogout, textDecoration: 'none' }}>{config.extraLink.label}</Link>}
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ background: '#F8FAFC', border: `1px solid ${colorLight}`, color: '#1E293B', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Sparkles size={20} color={color} />
          <div style={{ fontSize: '0.88rem' }}>{config.rule} — ไม่ต้องกรอกเพิ่ม แค่เช็คชื่อตามปกติ</div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <QuickDate value={date} onChange={setDate} color={color} />
          <div>
            <label style={lbl}>ช่วง CSV</label>
            <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as CsvPeriod)} style={inp}>
              <option value="month">รายเดือน ({monthLabel(month)})</option>
              <option value="year">รายปี ({yearLabel(year)})</option>
            </select>
          </div>
          <div>
            <label style={lbl}>ขอบเขต CSV</label>
            <select value={csvScope} onChange={e => setCsvScope(e.target.value)} style={inp}>
              <option value="all">ทุกชั้น</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>ชั้น {c.label}</option>)}
            </select>
          </div>
          <button onClick={exportCsv} style={{ ...btnPrimary, background: color }}><Download size={14} /> โหลด CSV</button>
        </div>

        <div style={{ background: `linear-gradient(135deg,${color},${colorLight})`, color: 'white', borderRadius: 14, padding: '1.25rem', marginBottom: 14 }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 700, letterSpacing: 1 }}>📊 สรุปวันที่ {fmtThai(date)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ratePerHead ? 4 : 3},minmax(0,1fr))`, gap: 10, marginTop: 12 }}>
            <BigStat label="นักเรียนทั้งหมด" value={totalStudents} color="#FCD34D" />
            <BigStat label={`${icon} ${countedLabel}`} value={dayTotal} color="#A7F3D0" />
            <BigStat label="%" value={totalStudents ? Math.round((dayTotal / totalStudents) * 100) + '%' : '-'} color="#FFFFFF" />
            {ratePerHead ? <BigStat label={`งบวันนี้ (${ratePerHead} บ./คน)`} value={baht(dayTotal)} color="#FDE68A" /> : null}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, overflowX: 'auto' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>📋 แยกตามชั้น</h6>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={th}>ชั้น</th><th style={th}>นักเรียน</th><th style={th}>{icon} {countedLabel}</th><th style={th}>%</th>
                {ratePerHead ? <th style={th}>งบ (บาท)</th> : null}
                <th style={th}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {dayPerClass.map(x => {
                const pct = x.c.students.length ? Math.round((x.count / x.c.students.length) * 100) : 0;
                return (
                  <tr key={x.c.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{x.c.label}</td>
                    <td style={td}>{x.c.students.length}</td>
                    <td style={{ ...td, color: '#047857', fontWeight: 800 }}>{x.count}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{x.checked ? `${pct}%` : '-'}</td>
                    {ratePerHead ? <td style={td}>{x.checked ? (x.count * ratePerHead).toLocaleString('th-TH') : '-'}</td> : null}
                    <td style={td}>{x.checked
                      ? <span style={{ background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>เช็คชื่อแล้ว</span>
                      : <span style={{ background: '#F1F5F9', color: '#64748B', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem' }}>ยังไม่เช็คชื่อ</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, overflowX: 'auto' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>📅 สรุปเดือน {monthLabel(month)}</h6>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginTop: 10 }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={th}>ชั้น</th><th style={th}>วันที่เช็ค</th><th style={th}>{icon} รวม ({unit})</th><th style={th}>เฉลี่ย/วัน</th>
                {ratePerHead ? <th style={th}>งบรวม (บาท)</th> : null}
              </tr>
            </thead>
            <tbody>
              {monthPerClass.map(x => (
                <tr key={x.c.id} style={{ borderBottom: '1px solid #FFF7ED' }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{x.c.label}</td>
                  <td style={td}>{x.days}</td>
                  <td style={{ ...td, color: '#047857', fontWeight: 800 }}>{x.total}</td>
                  <td style={td}>{x.days ? Math.round(x.total / x.days) : 0}</td>
                  {ratePerHead ? <td style={td}>{(x.total * ratePerHead).toLocaleString('th-TH')}</td> : null}
                </tr>
              ))}
              <tr style={{ background: '#FFF7ED', fontWeight: 900 }}>
                <td style={{ ...td, textAlign: 'left' }}>รวมทั้งหมด</td>
                <td style={td}>—</td>
                <td style={{ ...td, color: '#047857' }}>{monthTotal}</td>
                <td style={td}>—</td>
                {ratePerHead ? <td style={td}>{(monthTotal * ratePerHead).toLocaleString('th-TH')}</td> : null}
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
          <h6 style={{ fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>🗓️ ย้อนประวัติ (30 วันล่าสุดที่มีการเช็ค)</h6>
          <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: 12 }}>คลิกวันที่เพื่อดูรายงานของวันนั้น</p>
          {historyDates.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#64748B' }}>ยังไม่มีประวัติ</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {historyDates.map(d => {
                const total = allDocs.filter(x => x.date === d).reduce((s, x) => s + countDoc(x), 0);
                return (
                  <button key={d} onClick={() => setDate(d)} style={{
                    padding: '8px 12px', borderRadius: 8, border: d === date ? `2px solid ${color}` : '1px solid #E2E8F0',
                    background: d === date ? '#F8FAFC' : 'white', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0F172A' }}>{fmtThai(d)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 700 }}>{icon} {total}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function BigStat({ label, value, color }: { label: string; value: React.ReactNode; color: string }) {
  return <div style={{ background: 'rgba(0,0,0,0.14)', borderRadius: 10, padding: '0.75rem', minWidth: 0 }}>
    <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: 'clamp(1.3rem, 4vw, 2rem)', fontWeight: 900, color, marginTop: 4, overflowWrap: 'anywhere' }}>{value}</div>
  </div>;
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem', minWidth: 190 };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#64748B', marginBottom: 4, fontWeight: 800 };
const btnPrimary: React.CSSProperties = { color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
