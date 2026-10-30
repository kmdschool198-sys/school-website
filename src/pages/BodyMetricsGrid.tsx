import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { findDmcStudent } from '../data/dmcStudentMaster';
import { ChevronLeft, LogOut, Printer, Download, ClipboardPaste, Sparkles } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { THAI_MONTHS_FULL, downloadCsvReport, makeSectionedReportRows, monthLabel, yearLabel } from '../utils/csvReport';
import { SCHOOL_NAME } from '../config/siteLinks';
import { toast } from '../components/GlobalToast';
import ExcelPasteModal from '../components/ExcelPasteModal';
import { parseClipboardTable, cleanNumeric, isTabularPaste } from '../utils/excelPaste';

const COLOR = '#EC4899';
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

interface Student { id: string; code?: string; name: string; emoji?: string; weight?: number; height?: number; bmi?: number; }
interface LogEntry { id: string; classLabel?: string; studentName?: string; studentId?: string; weight?: number; height?: number; bmi?: number; date?: string; }
type CsvPeriod = 'month' | 'year';
type CsvScope = 'class' | 'all';

export default function BodyMetricsGridPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="⚖️ บันทึกน้ำหนัก-ส่วนสูง" subtitle="กรอกในตารางต่อชั้น+เดือน" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const { classes: availableClasses } = useSchoolRoster();
  const [classId, setClassId] = useState('');
  const [month, setMonth] = useState(thisMonth());
  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('month');
  const [csvScope, setCsvScope] = useState<CsvScope>('class');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [healthConsentOk] = useState(true);
  const [showPasteModal, setShowPasteModal] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, 'log_body_metrics'), snap => {
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

  // Find existing log entry for a student in this month (or fallback to DMC 1/2569 baseline weight/height)
  const matchesInClass = (l: LogEntry, s: Student, classLabel?: string) =>
    (l.classLabel === classLabel || !l.classLabel) &&
    (l.studentId === s.id || (l.studentName && l.studentName.trim() === s.name.trim()));

  const dmcFallbackEntry = (s: Student, classLabel?: string): LogEntry | undefined => {
    const dmc = findDmcStudent(s.code || s.id, s.name);
    const w = s.weight ?? dmc?.weight;
    const h = s.height ?? dmc?.height;
    if (!w && !h) return undefined;
    const bmi = (w && h && h > 0) ? Math.round((w / Math.pow(h / 100, 2)) * 10) / 10 : undefined;
    return {
      id: `dmc_${s.id}`,
      classLabel,
      studentId: s.id,
      studentName: s.name,
      weight: w,
      height: h,
      bmi,
    };
  };

  const findEntry = (s: Student): LogEntry | undefined => {
    const cloud = logs.find(l =>
      l.date?.startsWith(month) &&
      matchesInClass(l, s, current?.label)
    );
    return cloud || dmcFallbackEntry(s, current?.label);
  };

  const findEntryForMonth = (s: Student, targetMonth: string, classLabel?: string): LogEntry | undefined => {
    const cloud = logs.find(l =>
      l.date?.startsWith(targetMonth) &&
      matchesInClass(l, s, classLabel)
    );
    return cloud || dmcFallbackEntry(s, classLabel);
  };

  const updateMetric = async (s: Student, patch: { weight?: number; height?: number }) => {
    if (!healthConsentOk) {
      alert('กรุณารับทราบ notice ข้อมูลสุขภาพก่อนบันทึกน้ำหนัก-ส่วนสูง');
      return;
    }
    if (!current) return;
    const existing = findEntry(s);
    const id = existing?.id || `bm_${classId}_${month}_${s.id}`;
    const weight = patch.weight !== undefined ? patch.weight : existing?.weight;
    const height = patch.height !== undefined ? patch.height : existing?.height;
    const bmi = (weight && height && height > 0) ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : undefined;
    const docData: any = {
      id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
      studentName: s.name, date: `${month}-15`, teacherName: userName,
      createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
    };
    if (weight !== undefined && weight !== null) docData.weight = weight;
    if (height !== undefined && height !== null) docData.height = height;
    if (bmi !== undefined) docData.bmi = bmi;
    try {
      // Remove undefined values
      if (weight == null && height == null) {
        // delete the entry
        if (existing) await deleteDoc(doc(db, 'log_body_metrics', existing.id));
      } else {
        await setDoc(doc(db, 'log_body_metrics', id), docData);
        setSavedAt(new Date());
      }
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const handleDirectPaste = async (e: React.ClipboardEvent<HTMLInputElement>, startIdx: number, field: 'weight' | 'height') => {
    const text = e.clipboardData.getData('text');
    if (!isTabularPaste(text)) return;
    e.preventDefault();

    if (!healthConsentOk) {
      alert('กรุณารับทราบ notice ข้อมูลสุขภาพก่อนบันทึกน้ำหนัก-ส่วนสูง');
      return;
    }
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
      const id = existing?.id || `bm_${classId}_${month}_${s.id}`;

      let weight = existing?.weight;
      let height = existing?.height;

      const cells = rows[r];
      if (field === 'weight') {
        if (cells.length >= 2) {
          const w = cleanNumeric(cells[0]);
          const h = cleanNumeric(cells[1]);
          if (w !== null) weight = w;
          if (h !== null) height = h;
        } else {
          const w = cleanNumeric(cells[0]);
          if (w !== null) weight = w;
        }
      } else {
        const h = cleanNumeric(cells[0]);
        if (h !== null) height = h;
      }

      const bmi = (weight && height && height > 0) ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : undefined;
      const docData: any = {
        id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
        studentName: s.name, date: `${month}-15`, teacherName: userName,
        createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
      };
      if (weight !== undefined && weight !== null) docData.weight = weight;
      if (height !== undefined && height !== null) docData.height = height;
      if (bmi !== undefined) docData.bmi = bmi;

      if (weight == null && height == null) {
        if (existing) batch.delete(doc(db, 'log_body_metrics', existing.id));
      } else {
        batch.set(doc(db, 'log_body_metrics', id), docData);
      }
      updatedCount++;
    }

    try {
      await batch.commit();
      setSavedAt(new Date());
      toast.success(`วางข้อมูลจาก Excel สำเร็จ ${updatedCount} คน`);
    } catch (err: any) {
      toast.error('วางข้อมูลไม่สำเร็จ: ' + (err?.message || err));
    }
  };

  const handleModalApply = async (records: Array<{ studentId: string; values: Record<string, number | null> }>) => {
    if (!healthConsentOk) {
      alert('กรุณารับทราบ notice ข้อมูลสุขภาพก่อนบันทึกน้ำหนัก-ส่วนสูง');
      return;
    }
    if (!current) return;

    const batch = writeBatch(db);
    let count = 0;

    for (const rec of records) {
      const s = students.find(st => st.id === rec.studentId);
      if (!s) continue;
      const existing = findEntry(s);
      const id = existing?.id || `bm_${classId}_${month}_${s.id}`;

      let weight = rec.values.weight !== undefined ? (rec.values.weight ?? undefined) : existing?.weight;
      let height = rec.values.height !== undefined ? (rec.values.height ?? undefined) : existing?.height;
      const bmi = (weight && height && height > 0) ? Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10 : undefined;

      const docData: any = {
        id, classLabel: current.label, studentId: s.id, studentCode: s.code || s.id,
        studentName: s.name, date: `${month}-15`, teacherName: userName,
        createdAt: existing ? (existing as any).createdAt || Date.now() : Date.now(),
      };
      if (weight !== undefined && weight !== null) docData.weight = weight;
      if (height !== undefined && height !== null) docData.height = height;
      if (bmi !== undefined) docData.bmi = bmi;

      if (weight == null && height == null) {
        if (existing) batch.delete(doc(db, 'log_body_metrics', existing.id));
      } else {
        batch.set(doc(db, 'log_body_metrics', id), docData);
      }
      count++;
    }

    try {
      await batch.commit();
      setSavedAt(new Date());
      toast.success(`บันทึกข้อมูลน้ำหนัก-ส่วนสูง ${count} คน เรียบร้อย`);
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
          weight: e?.weight ?? null,
          height: e?.height ?? null,
        },
      };
    });
  }, [students, logs, month, current]);

  const filledCount = students.filter(s => findEntry(s)).length;
  const [yr, mn] = month.split('-').map(Number);

  const exportCsv = () => {
    if (!current) return;
    if (!healthConsentOk) {
      alert('กรุณารับทราบ notice ข้อมูลสุขภาพก่อนดาวน์โหลด CSV');
      return;
    }
    const year = month.slice(0, 4);
    const targetClasses = csvScope === 'all' ? availableClasses : [current];
    const sections = targetClasses.map(classItem => {
      const rows = csvPeriod === 'month'
        ? classItem.students.map((s, i) => {
        const e = findEntryForMonth(s, month, classItem.label);
        return [
          String(i + 1),
          s.code || '',
          s.name,
          e?.weight !== undefined ? String(e.weight) : '-',
          e?.height !== undefined ? String(e.height) : '-',
          e?.bmi !== undefined ? String(e.bmi) : '-',
          e?.bmi ? bmiStatus(e.bmi) : '-',
        ];
      })
        : classItem.students.map((s, i) => {
        const row = [
          String(i + 1),
          s.code || '',
          s.name,
        ];
        let filled = 0;
        Array.from({ length: 12 }, (_, idx) => idx + 1).forEach(m => {
          const targetMonth = `${year}-${String(m).padStart(2, '0')}`;
          const e = findEntryForMonth(s, targetMonth, classItem.label);
          if (e?.weight || e?.height || e?.bmi) filled++;
          row.push(e ? `${e.weight ?? '-'}/${e.height ?? '-'}/${e.bmi ?? '-'}` : '-');
        });
        row.push(String(filled));
        return row;
      });

      return {
        title: `ชั้น ${classItem.label}`,
        headers: csvPeriod === 'month'
          ? ['เลขที่', 'รหัส', 'ชื่อ-สกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI', 'สถานะ']
          : ['เลขที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m} (นน./สส./BMI)`), 'จำนวนเดือนที่บันทึก'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีรายชื่อนักเรียน']],
      };
    });
    const reportRows = makeSectionedReportRows({
      title: `รายงานน้ำหนัก-ส่วนสูง-BMI ${SCHOOL_NAME}`,
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [['ขอบเขต', csvScope === 'all' ? 'ทุกชั้น' : `ชั้น ${current.label}`], ['ผู้ส่งออก', userName], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      sections,
      footerRows: [['หมายเหตุ', csvPeriod === 'year' ? 'ช่องรายปีแสดง น้ำหนัก/ส่วนสูง/BMI' : 'ข้อมูลสุขภาพ ใช้ภายในโรงเรียนเท่านั้น']],
    });
    downloadCsvReport(`น้ำหนักส่วนสูง_${csvScope === 'all' ? 'ทุกชั้น' : current.label}_${csvPeriod === 'month' ? `รายเดือน_${month}` : `รายปี_${year}`}`, reportRows);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: `linear-gradient(135deg,${COLOR},#F472B6)`, color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>⚖️ บันทึกน้ำหนัก-ส่วนสูง</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>กรอกในตาราง · บันทึกอัตโนมัติ · {userName}</div>
          </div>
          <Link to="/print-body-metrics" style={{ ...btnLogout, textDecoration: 'none' }}>
            <Printer size={12} /> พิมพ์ฟอร์ม
          </Link>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออก</button>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.25rem' }}>
        <div style={{
          marginBottom: 14, background: '#FDF2F8', border: '1px solid #FBCFE8', borderRadius: 12,
          padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', fontWeight: 800, color: '#9D174D' }}>
            <Sparkles size={16} /> ⚡ ระบบดึงข้อมูลน้ำหนัก-ส่วนสูงตั้งต้นจากทะเบียน DMC 1/2569 ให้อัตโนมัติ (แก้ไขหรือวางจาก Excel ทับได้ทันที)
          </div>
          <Link
            to="/print-body-metrics"
            style={{
              background: '#BE185D', color: 'white', textDecoration: 'none',
              padding: '6px 14px', borderRadius: 8, fontWeight: 800, fontSize: '0.78rem',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Printer size={14} /> พิมพ์ฟอร์มราชการ (A4)
          </Link>
        </div>

        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>ชั้นเรียน</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>เดือน</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>
              📅 {THAI_MONTHS[mn - 1]} พ.ศ.{yr + 543}
            </div>
          </div>
          <div>
            <label style={lbl}>ช่วง CSV</label>
            <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as CsvPeriod)} style={inp}>
              <option value="month">รายเดือน ({monthLabel(month)})</option>
              <option value="year">รายปี ({yearLabel(month.slice(0, 4))})</option>
            </select>
          </div>
          <div>
            <label style={lbl}>ขอบเขต CSV</label>
            <select value={csvScope} onChange={e => setCsvScope(e.target.value as CsvScope)} style={inp}>
              <option value="class">ห้องนี้ ({current?.label || '-'})</option>
              <option value="all">ทุกชั้น</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ background: '#FFF7ED', borderRadius: 8, padding: '10px 14px', fontSize: '0.85rem', color: '#7C2D12', flex: 1 }}>
              ✏️ กรอกแล้ว <b>{filledCount}/{students.length}</b> คน
              {savedAt && <span style={{ color: '#10B981', marginLeft: 8 }}>✓ บันทึก {savedAt.toLocaleTimeString('th-TH')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                if (!healthConsentOk) {
                  alert('กรุณารับทราบ notice ข้อมูลสุขภาพก่อนใช้งาน');
                  return;
                }
                setShowPasteModal(true);
              }}
              style={{
                flex: 1,
                background: '#0F172A',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <ClipboardPaste size={14} /> วางจาก Excel
            </button>
            <button
              onClick={exportCsv}
              style={{
                flex: 1,
                background: COLOR,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Download size={14} /> โหลด CSV
            </button>
          </div>
        </div>

        {students.length === 0 ? (
          <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
            ยังไม่มีรายชื่อในชั้นนี้
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                    <th style={th}>#</th>
                    <th style={th}>รหัส</th>
                    <th style={{ ...th, textAlign: 'left', minWidth: 200 }}>ชื่อ-สกุล</th>
                    <th style={th}>น้ำหนัก (กก.)</th>
                    <th style={th}>ส่วนสูง (ซม.)</th>
                    <th style={th}>BMI</th>
                    <th style={th}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const e = findEntry(s);
                    const bmi = e?.bmi;
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                        <td style={td}>{i + 1}</td>
                        <td style={{ ...td, fontSize: '0.78rem' }}>{s.code}</td>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{s.emoji} {s.name}</td>
                        <td style={td}>
                          <input type="number" min={0} max={200} step="0.1"
                            key={`w_${s.id}_${e?.weight ?? ''}`}
                            defaultValue={e?.weight ?? ''}
                            disabled={!healthConsentOk}
                            onPaste={ev => handleDirectPaste(ev, i, 'weight')}
                            onBlur={ev => {
                              const v = ev.target.value;
                              updateMetric(s, { weight: v === '' ? undefined : Number(v) });
                            }}
                            title="สามารถกด Ctrl+V เพื่อวางคอลัมน์จาก Excel ได้"
                            style={{ ...inpNum, opacity: healthConsentOk ? 1 : 0.55 }} />
                        </td>
                        <td style={td}>
                          <input type="number" min={0} max={250} step="0.1"
                            key={`h_${s.id}_${e?.height ?? ''}`}
                            defaultValue={e?.height ?? ''}
                            disabled={!healthConsentOk}
                            onPaste={ev => handleDirectPaste(ev, i, 'height')}
                            onBlur={ev => {
                              const v = ev.target.value;
                              updateMetric(s, { height: v === '' ? undefined : Number(v) });
                            }}
                            title="สามารถกด Ctrl+V เพื่อวางคอลัมน์จาก Excel ได้"
                            style={{ ...inpNum, opacity: healthConsentOk ? 1 : 0.55 }} />
                        </td>
                        <td style={{ ...td, fontWeight: 800, color: bmi ? bmiColor(bmi) : '#94A3B8' }}>
                          {bmi || '-'}
                        </td>
                        <td style={td}>
                          {bmi && <span style={{ background: bmiColor(bmi) + '22', color: bmiColor(bmi), padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>{bmiStatus(bmi)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 14px', background: '#FFF7ED', fontSize: '0.78rem', color: '#7C2D12' }}>
              💡 กรอกตัวเลข → กดออกจากช่อง = <b>บันทึกอัตโนมัติ</b> · สามารถกด <b>Ctrl+V</b> ที่ช่องเพื่อวางรวดเดียว หรือกดปุ่ม <b>วางจาก Excel</b> ด้านบน · BMI คำนวณให้เอง
            </div>
          </div>
        )}

        <ExcelPasteModal
          isOpen={showPasteModal}
          onClose={() => setShowPasteModal(false)}
          title={`📋 วางน้ำหนัก-ส่วนสูงจาก Excel (ห้อง ${current?.label || ''})`}
          subtitle="คัดลอกเซลล์จาก Excel (1 หรือ 2 คอลัมน์) แล้ววางเพื่ออัปเดตทั้งตารางพร้อมกัน"
          themeColor={COLOR}
          students={pasteStudentRows}
          columns={[
            { key: 'weight', label: 'น้ำหนัก', unit: 'กก.' },
            { key: 'height', label: 'ส่วนสูง', unit: 'ซม.' },
          ]}
          onApply={handleModalApply}
        />
      </main>
    </div>
  );
}

function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function bmiColor(b: number) {
  if (b < 16) return '#EF4444'; if (b < 18.5) return '#F59E0B';
  if (b < 25) return '#10B981'; if (b < 30) return '#F59E0B'; return '#EF4444';
}
function bmiStatus(b: number) {
  if (b < 16) return 'ผอมมาก'; if (b < 18.5) return 'ผอม';
  if (b < 25) return 'สมส่วน'; if (b < 30) return 'ท้วม'; return 'อ้วน';
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const inpNum: React.CSSProperties = { width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.85rem', textAlign: 'center' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center' };
const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'center' };
