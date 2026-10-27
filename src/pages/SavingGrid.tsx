import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { ChevronLeft, LogOut, Download, ClipboardPaste, Printer, Sparkles } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import QuickDate from '../components/QuickDate';
import { THAI_MONTHS_FULL, daysInMonth, downloadCsvReport, makeSectionedReportRows, monthLabel, yearLabel } from '../utils/csvReport';
import { toast } from '../components/GlobalToast';
import ExcelPasteModal from '../components/ExcelPasteModal';
import { parseClipboardTable, cleanNumeric, isTabularPaste } from '../utils/excelPaste';

const COLOR = '#10B981';
const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface LogEntry { id: string; classLabel?: string; studentName?: string; studentId?: string; amount?: number; date?: string; }
type CsvPeriod = 'month' | 'year';
type CsvScope = 'class' | 'all';

export default function SavingGridPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="💰 บันทึกออมเงินนักเรียน" subtitle="กรอกในตาราง · บันทึกอัตโนมัติ · พิมพ์ฟอร์มราชการ A4" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const { classes: availableClasses } = useSchoolRoster();
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('month');
  const [csvScope, setCsvScope] = useState<CsvScope>('class');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'log_saving'), snap => {
      const arr: LogEntry[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      setLogs(arr);
    });
  }, []);

  useEffect(() => {
    if (!classId && availableClasses.length) setClassId(availableClasses[0].id);
  }, [availableClasses, classId]);

  const current = availableClasses.find(c => c.id === classId);
  const students = current?.students || [];
  const currentMonth = date.slice(0, 7);

  // Match by id OR name (handles old data without studentId)
  const matchesInClass = (l: LogEntry, s: Student, classLabel?: string) =>
    (l.classLabel === classLabel || !l.classLabel) &&
    (l.studentId === s.id || (l.studentName && l.studentName.trim() === s.name.trim()));
  const matches = (l: LogEntry, s: Student) => matchesInClass(l, s, current?.label);

  const findEntry = (s: Student) => logs.find(l => matches(l, s) && l.date === date);

  const monthBalanceOf = (s: Student) => logs
    .filter(l => matches(l, s) && l.date?.startsWith(currentMonth))
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const balanceOf = (s: Student) => logs
    .filter(l => matches(l, s))
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const balanceOfInClass = (s: Student, classLabel?: string) => logs
    .filter(l => matchesInClass(l, s, classLabel))
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  const updateAmount = async (s: Student, amount: number | undefined) => {
    if (!current) return;
    const existing = findEntry(s);
    const id = existing?.id || `sv_${classId}_${date}_${s.id}`;
    if (!amount || amount <= 0) {
      if (existing) {
        try { await deleteDoc(doc(db, 'log_saving', existing.id)); } catch (e: any) { alert('❌ ' + (e?.message || e)); }
      }
      return;
    }
    try {
      await setDoc(doc(db, 'log_saving', id), {
        id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
        studentName: s.name, amount, date, teacherName: userName,
        createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
      });
      setSavedAt(new Date());
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  // Bulk fill all students in current class for today
  const bulkSetAmountForClass = async (amount: number) => {
    if (!current || students.length === 0) return;
    if (amount > 0 && !confirm(`บันทึกยอดออมวันนี้ คนละ ${amount} บาท ให้กับนักเรียนทุกคนในชั้น ${current.label} (${students.length} คน)?`)) return;
    if (amount === 0 && !confirm(`ล้างยอดออมวันนี้ของชั้น ${current.label} ทั้งหมด?`)) return;

    const batch = writeBatch(db);
    students.forEach(s => {
      const existing = findEntry(s);
      const id = existing?.id || `sv_${classId}_${date}_${s.id}`;
      if (amount <= 0) {
        if (existing) batch.delete(doc(db, 'log_saving', existing.id));
      } else {
        batch.set(doc(db, 'log_saving', id), {
          id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
          studentName: s.name, amount, date, teacherName: userName,
          createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
        });
      }
    });

    try {
      await batch.commit();
      setSavedAt(new Date());
      toast.success(amount > 0 ? `บันทึกออมเงินทั้งห้อง คนละ ${amount} บาท เรียบร้อย` : 'ล้างยอดออมวันนี้เรียบร้อย');
    } catch (err: any) {
      toast.error('บันทึกไม่สำเร็จ: ' + (err?.message || err));
    }
  };

  const handleDirectPaste = async (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number) => {
    const text = e.clipboardData.getData('text');
    if (!isTabularPaste(text)) return;
    e.preventDefault();
    if (!current) return;

    const rows = parseClipboardTable(text);
    if (rows.length === 0) return;

    const batch = writeBatch(db);
    let updatedCount = 0;

    for (let r = 0; r < rows.length; r++) {
      const sIdx = startIdx + r;
      if (sIdx >= students.length) break;
      const s = students[sIdx];
      const existing = findEntry(s);
      const id = existing?.id || `sv_${classId}_${date}_${s.id}`;

      const amount = cleanNumeric(rows[r][0]);

      if (!amount || amount === 0) {
        if (existing) {
          batch.delete(doc(db, 'log_saving', existing.id));
        }
      } else {
        batch.set(doc(db, 'log_saving', id), {
          id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
          studentName: s.name, amount, date, teacherName: userName,
          createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
        });
      }
      updatedCount++;
    }

    try {
      await batch.commit();
      setSavedAt(new Date());
      toast.success(`วางข้อมูลเงินออมจาก Excel สำเร็จ ${updatedCount} คน`);
    } catch (err: any) {
      toast.error('วางข้อมูลไม่สำเร็จ: ' + (err?.message || err));
    }
  };

  const handleModalApply = async (records: Array<{ studentId: string; values: Record<string, number | null> }>) => {
    if (!current) return;
    const batch = writeBatch(db);
    let count = 0;

    for (const rec of records) {
      const s = students.find(st => st.id === rec.studentId);
      if (!s) continue;
      const existing = findEntry(s);
      const id = existing?.id || `sv_${classId}_${date}_${s.id}`;
      const amount = rec.values.amount;

      if (!amount || amount === 0) {
        if (existing) {
          batch.delete(doc(db, 'log_saving', existing.id));
        }
      } else {
        batch.set(doc(db, 'log_saving', id), {
          id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
          studentName: s.name, amount, date, teacherName: userName,
          createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
        });
      }
      count++;
    }

    try {
      await batch.commit();
      setSavedAt(new Date());
      toast.success(`บันทึกยอดเงินออม ${count} คน เรียบร้อย`);
    } catch (err: any) {
      toast.error('บันทึกไม่สำเร็จ: ' + (err?.message || err));
    }
  };

  const pasteStudentRows = useMemo(() => {
    return students.map(s => {
      const e = findEntry(s);
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        currentValues: {
          amount: e?.amount ?? null,
        },
      };
    });
  }, [students, logs, date, current]);

  const todayTotal = students.reduce((s, st) => s + (findEntry(st)?.amount || 0), 0);
  const monthTotal = students.reduce((s, st) => s + monthBalanceOf(st), 0);
  const allTimeTotal = students.reduce((s, st) => s + balanceOf(st), 0);
  const filledCount = students.filter(s => findEntry(s)).length;

  const exportCsv = () => {
    if (!current) return;
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);
    const days = daysInMonth(month);
    const targetClasses = csvScope === 'all' ? availableClasses : [current];

    const sections = targetClasses.map(classItem => {
      const rows = csvPeriod === 'month'
        ? classItem.students.map((s, i) => {
          const row = [String(i + 1), s.code || '', s.name];
          let monthSum = 0;
          days.forEach(d => {
            const dateStr = `${month}-${String(d).padStart(2, '0')}`;
            const log = logs.find(l => matchesInClass(l, s, classItem.label) && l.date === dateStr);
            const amt = log?.amount || 0;
            row.push(amt > 0 ? String(amt) : '-');
            monthSum += amt;
          });
          row.push(String(monthSum), String(balanceOfInClass(s, classItem.label)));
          return row;
        })
        : classItem.students.map((s, i) => {
          const row = [String(i + 1), s.code || '', s.name];
          let yearSum = 0;
          Array.from({ length: 12 }, (_, idx) => idx + 1).forEach(m => {
            const monthPrefix = `${year}-${String(m).padStart(2, '0')}`;
            const sum = logs
              .filter(l => matchesInClass(l, s, classItem.label) && l.date?.startsWith(monthPrefix))
              .reduce((total, log) => total + (Number(log.amount) || 0), 0);
            row.push(sum > 0 ? String(sum) : '-');
            yearSum += sum;
          });
          row.push(String(yearSum), String(balanceOfInClass(s, classItem.label)));
          return row;
        });
      return {
        title: `ชั้น ${classItem.label}`,
        headers: csvPeriod === 'month'
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...days.map(String), 'รวมเดือนนี้', 'สะสมทั้งหมด']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL, 'รวมปีนี้', 'สะสมทั้งหมด'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });
    const reportRows = makeSectionedReportRows({
      title: 'รายงานออมเงินนักเรียน โรงเรียนบ้านคลองมดแดง',
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${current.label}`], ['ผู้ส่งออก', userName], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      sections,
      footerRows: [['หมายเหตุ', csvPeriod === 'month' ? 'ช่องวันที่เป็นจำนวนเงินที่ออมในวันนั้น' : 'ช่องเดือนเป็นยอดรวมเงินออมของเดือนนั้น']],
    });
    downloadCsvReport(`ออมเงิน_${csvScope === 'all' ? 'ทุกชั้น' : current.label}_${csvPeriod === 'month' ? `รายเดือน_${month}` : `รายปี_${year}`}`, reportRows);
  };

  const [yStr, mStr, dStr] = date.split('-');
  const thaiDateLabel = `${Number(dStr)} ${THAI_MONTHS_FULL[Number(mStr) - 1]} พ.ศ. ${Number(yStr) + 543}`;

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header className="no-print" style={{ background: `linear-gradient(135deg,${COLOR},#059669)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>💰 ระบบออมทรัพย์นักเรียน</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>กรอกไว 1 คลิก · วางจาก Excel · พิมพ์แบบฟอร์มราชการ A4 · {userName}</div>
          </div>
          <button onClick={() => window.print()} style={{ ...btnLogout, background: 'white', color: '#065F46', border: 'none' }}>
            <Printer size={14} /> พิมพ์ฟอร์มราชการ (A4)
          </button>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main className="no-print" style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 12, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>ชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <QuickDate value={date} onChange={setDate} color={COLOR} />
          <div>
            <label style={lbl}>ช่วง CSV</label>
            <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as CsvPeriod)} style={inp}>
              <option value="month">รายเดือน ({monthLabel(date.slice(0, 7))})</option>
              <option value="year">รายปี ({yearLabel(date.slice(0, 4))})</option>
            </select>
          </div>
          <div>
            <label style={lbl}>ขอบเขต CSV</label>
            <select value={csvScope} onChange={e => setCsvScope(e.target.value as CsvScope)} style={inp}>
              <option value="class">ห้องนี้ ({current?.label || '-'})</option>
              <option value="all">ทุกชั้น</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowPasteModal(true)}
              style={{
                ...btnSecondary,
                background: '#0F172A',
                color: 'white',
                border: 'none',
              }}
            >
              <ClipboardPaste size={14} /> วางจาก Excel
            </button>
            <button onClick={() => window.print()} style={{ ...btnSecondary, background: '#1D4ED8', color: 'white', border: 'none' }}>
              <Printer size={14} /> พิมพ์ใบสรุปออมทรัพย์ (A4)
            </button>
            <button onClick={exportCsv} style={{ ...btnSecondary, background: COLOR, color: 'white', border: 'none' }}>
              <Download size={14} /> โหลด CSV
            </button>
          </div>
        </div>

        {/* 1-Click Bulk Fill Bar */}
        <div style={{
          background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12,
          padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#065F46', fontSize: '0.84rem' }}>
            <Sparkles size={16} /> ⚡ ทางลัดกรอกเร็วทั้งห้อง ({current?.label}):
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[5, 10, 20].map(amt => (
              <button
                key={amt}
                onClick={() => bulkSetAmountForClass(amt)}
                style={{
                  background: 'white', color: '#047857', border: '1px solid #6EE7B7',
                  borderRadius: 8, padding: '5px 12px', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                ออมทุกคน +{amt} ฿
              </button>
            ))}
            <button
              onClick={() => bulkSetAmountForClass(0)}
              style={{
                background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                borderRadius: 8, padding: '5px 12px', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
              }}
            >
              ล้างยอดวันนี้
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
          <Stat label="ออมวันนี้" value={`${todayTotal.toLocaleString('th-TH')} ฿`} color={COLOR} sub={`${filledCount}/${students.length} คน`} />
          <Stat label="รวมเดือนนี้" value={`${monthTotal.toLocaleString('th-TH')} ฿`} color="#0284C7" />
          <Stat label="ยอดสะสมห้องนี้" value={`${allTimeTotal.toLocaleString('th-TH')} ฿`} color="#3B82F6" />
          <Stat label="เฉลี่ยสะสมต่อคน" value={`${students.length ? Math.round(allTimeTotal / students.length).toLocaleString('th-TH') : 0} ฿`} color="#A855F7" />
        </div>

        {savedAt && <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginBottom: 8 }}>✓ บันทึกอัตโนมัติล่าสุด: {savedAt.toLocaleTimeString('th-TH')}</div>}

        {students.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
            ยังไม่มีรายชื่อในชั้นนี้
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                    <th style={th}>เลขที่</th>
                    <th style={th}>รหัส</th>
                    <th style={{ ...th, textAlign: 'left', minWidth: 200 }}>ชื่อ-สกุล</th>
                    <th style={th}>💰 ออมวันนี้ (฿)</th>
                    <th style={th}>⚡ กดเพิ่มด่วน (1 คลิก)</th>
                    <th style={th}>📅 รวมเดือนนี้ (฿)</th>
                    <th style={th}>📊 ยอดสะสมรวม (฿)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const e = findEntry(s);
                    const curAmt = e?.amount || 0;
                    const mBal = monthBalanceOf(s);
                    const bal = balanceOf(s);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? 'white' : '#F8FAFC' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{s.code}</td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{s.emoji} {s.name}</td>
                        <td style={td}>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            key={`amt_${s.id}_${e?.amount ?? ''}`}
                            defaultValue={e?.amount ?? ''}
                            onPaste={ev => handleDirectPaste(ev, i)}
                            onBlur={ev => updateAmount(s, ev.target.value === '' ? undefined : Number(ev.target.value))}
                            placeholder="0"
                            title="สามารถกด Ctrl+V เพื่อวางยอดเงินจาก Excel ได้"
                            style={{ ...inpNum, width: 90, fontWeight: 800, color: e?.amount ? COLOR : '#94A3B8', borderColor: e?.amount ? '#10B981' : '#CBD5E1' }}
                          />
                        </td>
                        <td style={td}>
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            {[5, 10, 20, 50].map(add => (
                              <button
                                key={add}
                                type="button"
                                onClick={() => updateAmount(s, curAmt + add)}
                                style={{
                                  padding: '3px 8px', borderRadius: 6, border: '1px solid #A7F3D0',
                                  background: '#ECFDF5', color: '#047857', fontWeight: 800, fontSize: '0.74rem', cursor: 'pointer',
                                }}
                              >
                                +{add}
                              </button>
                            ))}
                            {curAmt > 0 && (
                              <button
                                type="button"
                                onClick={() => updateAmount(s, undefined)}
                                style={{
                                  padding: '3px 7px', borderRadius: 6, border: '1px solid #FECACA',
                                  background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
                                }}
                              >
                                ล้าง
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ ...td, fontWeight: 700, color: mBal > 0 ? '#0284C7' : '#94A3B8' }}>
                          {mBal.toLocaleString('th-TH')}
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: bal > 0 ? '#3B82F6' : '#94A3B8' }}>
                          {bal.toLocaleString('th-TH')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#F0FDF4', fontWeight: 900, borderTop: '2px solid #A7F3D0' }}>
                    <td colSpan={3} style={{ ...td, textAlign: 'right' }}>รวมทั้งสิ้น ({students.length} คน)</td>
                    <td style={{ ...td, color: COLOR, fontSize: '1rem' }}>{todayTotal.toLocaleString('th-TH')} ฿</td>
                    <td style={td}>—</td>
                    <td style={{ ...td, color: '#0284C7', fontSize: '1rem' }}>{monthTotal.toLocaleString('th-TH')} ฿</td>
                    <td style={{ ...td, color: '#3B82F6', fontSize: '1rem' }}>{allTimeTotal.toLocaleString('th-TH')} ฿</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ padding: '10px 14px', background: '#FFF7ED', fontSize: '0.78rem', color: '#7C2D12' }}>
              💡 คลิกปุ่ม <b>+5 / +10 / +20</b> เพื่อบวกยอดออมได้ทันที หรือพิมพ์ตัวเลขแล้วกด Tab = <b>บันทึกอัตโนมัติ</b>
            </div>
          </div>
        )}

        <ExcelPasteModal
          isOpen={showPasteModal}
          onClose={() => setShowPasteModal(false)}
          title={`📋 วางยอดเงินออมจาก Excel (ห้อง ${current?.label || ''})`}
          subtitle="คัดลอกเซลล์ยอดเงินจาก Excel แล้วนำมาวางเพื่อบันทึกทั้งห้องพร้อมกัน"
          themeColor={COLOR}
          students={pasteStudentRows}
          columns={[
            { key: 'amount', label: 'ยอดออมวันนี้', unit: '฿', placeholder: '0' },
          ]}
          onApply={handleModalApply}
        />
      </main>

      {/* ─── OFFICIAL GOVERNMENT PRINT FORM (A4 PORTRAIT) ─── */}
      <div className="print-area" style={{ display: 'none', background: 'white', fontFamily: "'Sarabun', sans-serif", color: '#000' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <img
            src={`${import.meta.env.BASE_URL}images/school-logo.png`}
            alt="ตราโรงเรียน"
            style={{ width: 52, height: 52, objectFit: 'contain', marginBottom: 4 }}
          />
          <div style={{ fontWeight: 900, fontSize: '15pt', lineHeight: 1.3 }}>
            แบบรายงานการออมทรัพย์นักเรียนตามโครงการส่งเสริมการออมตามหลักปรัชญาของเศรษฐกิจพอเพียง
          </div>
          <div style={{ fontWeight: 800, fontSize: '12pt', lineHeight: 1.35 }}>
            โรงเรียนบ้านคลองมดแดง &nbsp; สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2
          </div>
          <div style={{ fontSize: '11pt', marginTop: 4 }}>
            ระดับชั้น <b>{current?.fullClassName || current?.label || '-'}</b> &nbsp;·&nbsp; ข้อมูล ณ วันที่ <b>{thaiDateLabel}</b>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={{ ...pTh, width: '7%' }}>เลขที่</th>
              <th style={{ ...pTh, width: '14%' }}>รหัสประจำตัว</th>
              <th style={{ ...pTh, width: '37%', textAlign: 'left', paddingLeft: 8 }}>ชื่อ - นามสกุล</th>
              <th style={{ ...pTh, width: '14%' }}>ออมวันนี้ (บาท)</th>
              <th style={{ ...pTh, width: '14%' }}>รวมเดือนนี้ (บาท)</th>
              <th style={{ ...pTh, width: '14%' }}>ยอดสะสมรวม (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const e = findEntry(s);
              const mBal = monthBalanceOf(s);
              const bal = balanceOf(s);
              return (
                <tr key={s.id}>
                  <td style={pTd}>{i + 1}</td>
                  <td style={pTd}>{s.code || '-'}</td>
                  <td style={{ ...pTd, textAlign: 'left', paddingLeft: 8 }}>{s.name}</td>
                  <td style={pTd}>{e?.amount ? e.amount.toLocaleString('th-TH') : '-'}</td>
                  <td style={pTd}>{mBal > 0 ? mBal.toLocaleString('th-TH') : '-'}</td>
                  <td style={{ ...pTd, fontWeight: 700 }}>{bal > 0 ? bal.toLocaleString('th-TH') : '-'}</td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 800, background: '#F8FAFC' }}>
              <td colSpan={3} style={{ ...pTd, textAlign: 'right', paddingRight: 10 }}>
                รวมทั้งสิ้น ({students.length} คน)
              </td>
              <td style={pTd}>{todayTotal.toLocaleString('th-TH')}</td>
              <td style={pTd}>{monthTotal.toLocaleString('th-TH')}</td>
              <td style={pTd}>{allTimeTotal.toLocaleString('th-TH')}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, textAlign: 'center', fontSize: '11pt' }}>
          <div>
            <div>ลงชื่อ ....................................................... ครูประจำชั้น/ผู้รับฝาก</div>
            <div style={{ marginTop: 4 }}>({current?.homeroomTeacher || userName || '.......................................................'})</div>
            <div style={{ marginTop: 2 }}>ครูประจำชั้น {current?.label}</div>
          </div>
          <div>
            <div>ลงชื่อ ....................................................... ผู้รับรองข้อมูล</div>
            <div style={{ marginTop: 4 }}>({DIRECTOR_NAME})</div>
            <div style={{ marginTop: 2 }}>ผู้อำนวยการโรงเรียนบ้านคลองมดแดง</div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>
    </div>
  );
}

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Stat({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return <div style={{ background: 'white', padding: 12, borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.4rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
    {sub && <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{sub}</div>}
  </div>;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const inpNum: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem', textAlign: 'center' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
const pTh: React.CSSProperties = { border: '1px solid #000', padding: '6px 4px', fontWeight: 800, textAlign: 'center' };
const pTd: React.CSSProperties = { border: '1px solid #000', padding: '5px 4px', textAlign: 'center' };
