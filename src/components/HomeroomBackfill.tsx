// เติมบันทึกโฮมรูมย้อนหลัง สำหรับวันที่เช็คชื่อแล้วแต่ยังไม่ได้บันทึกโฮมรูม
// ขั้นตอน: เลือกช่วง → ดูร่างทั้งหมด → แก้/ตัดวันที่ไม่ต้องการออก → ยืนยันบันทึก
import { useMemo, useState } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { Wand2, Save, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { toast } from './GlobalToast';
import { homeroomDocId, type HomeroomDoc } from '../data/homeroom';
import { draftForDate, type HomeroomDraft } from '../data/homeroomBackfill';

interface AttDoc { classId: string; date: string; records: Record<string, { status: string }>; }

const COLOR = '#7C3AED';

export default function HomeroomBackfill({
  classId, className, totalStudents, attDocs, existingLogs, teacherName, onDone,
}: {
  classId: string;
  className: string;
  totalStudents: number;
  attDocs: AttDoc[];
  existingLogs: HomeroomDoc[];
  teacherName: string;
  onDone: () => void;
}) {
  const [issueEvery, setIssueEvery] = useState(3);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  // วันที่เช็คชื่อแล้วของชั้นนี้ ที่ยังไม่มีบันทึกโฮมรูม
  const pendingDates = useMemo(() => {
    const done = new Set(existingLogs.filter(l => l.classId === classId).map(l => l.date));
    return attDocs
      .filter(a => a.classId === classId && !done.has(a.date))
      .map(a => a.date)
      .sort();
  }, [attDocs, existingLogs, classId]);

  const drafts: (HomeroomDraft & { present: number })[] = useMemo(
    () => pendingDates.map(date => {
      const att = attDocs.find(a => a.classId === classId && a.date === date);
      let present = 0;
      Object.values(att?.records || {}).forEach(r => { if (r.status === 'present') present++; });
      return { ...draftForDate(classId, date, issueEvery), present };
    }),
    [pendingDates, attDocs, classId, issueEvery],
  );

  const selected = drafts.filter(d => !skipped.has(d.date));
  const issueCount = selected.filter(d => d.hasIssue).length;

  const toggle = (date: string) => {
    setSkipped(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  };

  const saveAll = async () => {
    if (selected.length === 0) { toast.warn('ยังไม่ได้เลือกวันที่'); return; }
    if (!window.confirm(
      `บันทึกโฮมรูม ${className} จำนวน ${selected.length} วัน?\n\n` +
      `ข้อความเป็นร่างที่ระบบสร้างให้ กรุณาตรวจสอบความถูกต้องก่อนนำไปใช้เป็นเอกสารราชการ`,
    )) return;

    setSaving(true);
    setProgress(0);
    try {
      // Firestore จำกัด batch ละ 500 รายการ แบ่งเป็นชุดละ 400 เพื่อความปลอดภัย
      const CHUNK = 400;
      for (let i = 0; i < selected.length; i += CHUNK) {
        const batch = writeBatch(db);
        for (const draft of selected.slice(i, i + CHUNK)) {
          const payload: HomeroomDoc = {
            id: homeroomDocId(classId, draft.date),
            classId,
            className,
            date: draft.date,
            topic: draft.topic,
            problems: draft.problems,
            solutions: draft.solutions,
            suggestions: draft.suggestions,
            presentCount: draft.present,
            totalCount: totalStudents,
            teacherName,
            updatedAt: Date.now(),
          };
          batch.set(doc(db, 'homeroom', payload.id), payload);
        }
        await batch.commit();
        setProgress(Math.min(selected.length, i + CHUNK));
      }
      toast.success(`บันทึกย้อนหลัง ${selected.length} วันเรียบร้อย`);
      setSkipped(new Set());
      onDone();
    } catch (error: any) {
      console.error('Backfill failed', error);
      toast.error('บันทึกไม่สำเร็จ: ' + (error?.message || error));
    } finally {
      setSaving(false);
    }
  };

  if (pendingDates.length === 0) {
    return (
      <div style={card}>
        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748B' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
          ชั้น <b>{className}</b> บันทึกโฮมรูมครบทุกวันที่มีการเช็คชื่อแล้ว
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{
        display: 'flex', gap: 10, padding: '12px 14px', marginBottom: 16,
        background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, color: '#92400E',
      }}>
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
          ข้อความด้านล่างเป็น <b>ร่างที่ระบบสร้างให้</b> ไม่ใช่บันทึกเหตุการณ์จริงของแต่ละวัน
          แบบสรุปโฮมรูมเป็นเอกสารราชการ กรุณาอ่านและแก้ไขให้ตรงกับความเป็นจริงก่อนนำไปใช้
          (แก้รายวันได้ที่แท็บ “บันทึกโฮมรูม”)
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 16 }}>
        <div>
          <div style={lbl}>ชั้นเรียน</div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: COLOR }}>{className}</div>
        </div>
        <div>
          <div style={lbl}>วันที่เช็คชื่อแล้วแต่ยังไม่มีบันทึก</div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{pendingDates.length} วัน</div>
        </div>
        <div>
          <div style={lbl}>สัดส่วนวันที่มีปัญหาเล็กน้อย</div>
          <select
            value={issueEvery}
            onChange={e => setIssueEvery(Number(e.target.value))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontWeight: 700 }}
          >
            <option value={0}>เชิงบวกทั้งหมด</option>
            <option value={5}>น้อย (ราว 1 ใน 5 วัน)</option>
            <option value={3}>ปานกลาง (ราว 1 ใน 3 วัน)</option>
            <option value={2}>บ่อย (ราว 1 ใน 2 วัน)</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={saveAll} disabled={saving || selected.length === 0} style={{
          padding: '11px 20px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: COLOR, color: 'white', fontWeight: 800,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          opacity: saving || selected.length === 0 ? 0.6 : 1,
        }}>
          <Save size={16} />
          {saving ? `กำลังบันทึก ${progress}/${selected.length}...` : `บันทึก ${selected.length} วัน`}
        </button>
      </div>

      <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: 10 }}>
        <Wand2 size={13} style={{ verticalAlign: -2 }} /> เลือกไว้ <b>{selected.length}</b> วัน
        · เชิงบวกล้วน <b>{selected.length - issueCount}</b> วัน
        · มีปัญหาเล็กน้อย <b>{issueCount}</b> วัน
        · คลิกแถวเพื่อเอาออก/ใส่กลับ
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={th}>ใช้</th>
              <th style={th}>วันที่</th>
              <th style={th}>มา</th>
              <th style={th}>หัวข้อโฮมรูม</th>
              <th style={th}>ปัญหา / สิ่งที่พบ</th>
              <th style={th}>แนวทางของครู</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map(d => {
              const off = skipped.has(d.date);
              return (
                <tr
                  key={d.date}
                  onClick={() => toggle(d.date)}
                  style={{
                    borderTop: '1px solid #F1F5F9', cursor: 'pointer',
                    background: off ? '#F8FAFC' : d.hasIssue ? '#FFFBEB' : 'white',
                    opacity: off ? 0.45 : 1,
                  }}
                >
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input type="checkbox" readOnly checked={!off} />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700 }}>{fmtThai(d.date)}</td>
                  <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {d.present}/{totalStudents}
                  </td>
                  <td style={td}>{d.topic}</td>
                  <td style={td}>{d.problems}</td>
                  <td style={td}>{d.solutions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtThai(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

const card: React.CSSProperties = { background: 'white', borderRadius: 12, padding: '1.25rem' };
const lbl: React.CSSProperties = { fontSize: '0.75rem', color: '#64748B', fontWeight: 700, marginBottom: 4 };
const th: React.CSSProperties = { padding: '9px 10px', textAlign: 'left', fontWeight: 800, color: '#475569', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '9px 10px', verticalAlign: 'top', lineHeight: 1.5 };
