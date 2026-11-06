import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Wrench, Sun, Sunset, CheckCircle2, AlertTriangle, XCircle,
  Star, Plus, Trash2, Printer, Download, ExternalLink, Image as ImageIcon,
  ClipboardCheck, Calendar as CalendarIcon,
} from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import QuickDate from '../components/QuickDate';
import DriveImage from '../components/DriveImage';
import { useTeacherAuth } from '../utils/teacherAuth';
import { downloadCsvReport } from '../utils/csvReport';
import { SCHOOL_NAME, SCHOOL_AFFILIATION, DIRECTOR_NAME } from '../config/siteLinks';
import { janitorDocId } from '../data/janitor';
import { usePersonnel, personnelIdByName, isJanitor } from '../utils/usePersonnel';
const STORAGE_JANITOR_KEY = 'kmd_janitor_tasks_v1';

export type ComplianceStatus = 'ตามคำสั่งครบถ้วน' | 'ทำได้บางส่วน' | 'ไม่ตรงตามคำสั่ง' | 'รอตรวจประเมิน';

export interface JanitorDailyRecord {
  id: string;
  date: string;
  staffName: string;
  staffId?: string;        // personnel doc id (older records have only the name)
  assignedBy: string;
  morningOrder: string;
  morningChecklist: string[];
  morningDetail: string;
  morningPhotos: string[];
  afternoonOrder: string;
  afternoonChecklist: string[];
  afternoonDetail: string;
  afternoonPhotos: string[];
  complianceStatus: ComplianceStatus;
  qualityStars: number;
  evaluatorName: string;
  evaluatorComment: string;
  updatedAt: number;
}

const MORNING_PRESETS = [
  '🔓 เปิดประตูรั้วโรงเรียนและเปิดอาคารเรียนทุกหลัง',
  '🚩 เตรียมเสาธงและดูแลความสะอาดลานหน้าเสาธง',
  '🧹 กวาดใบไม้และเก็บขยะรอบบริเวณโรงเรียน',
  '💧 รดน้ำต้นไม้ สวนหย่อม และแปลงเกษตร',
  '🔌 ตรวจเช็กระบบน้ำประปา ปั๊มน้ำ และไฟฟ้าส่องสว่าง',
  '🌿 ตัดหญ้าและตัดแต่งกิ่งไม้บริเวณแนวรั้ว/สนาม',
];

const AFTERNOON_PRESETS = [
  '🚽 ล้างทำความสะอาดห้องน้ำนักเรียนและห้องน้ำครู',
  '🍱 ดูแลความสะอาดโรงอาหารและจัดการคัดแยกขยะหลังมื้อเที่ยง',
  '🛠️ ซ่อมแซมโต๊ะ-เก้าอี้ ประตู หน้าต่าง หรืออุปกรณ์ชำรุด',
  '🪑 จัดเตรียมสถานที่/ห้องประชุม/อาคารอเนกประสงค์',
  '🔒 ปิดหน้าต่าง ปิดไฟ-พัดลม และล็อกอาคารเรียนหลังเลิกเรียน',
];

export default function JanitorTaskPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return (
      <TeacherLoginGate
        title="🛠️ ระบบตรวจสอบการปฏิบัติงานนักการภารโรง (เช้า-บ่าย)"
        subtitle="บันทึกภารกิจเช้า-บ่าย แนบลิงก์รูปภาพหลักฐาน และประเมินผลการปฏิบัติงานตามคำสั่ง ผอ."
      />
    );
  }
  return <JanitorTaskContent userName={auth.name} />;
}

function JanitorTaskContent({ userName }: { userName: string }) {
  const [date, setDate] = useState<string>(todayStr());
  const [activeTab, setActiveTab] = useState<'daily' | 'history'>('daily');
  const [staffList, setStaffList] = useState<string[]>(['นักการภารโรงประจำโรงเรียน']);
  const [selectedStaff, setSelectedStaff] = useState<string>('นักการภารโรงประจำโรงเรียน');
  const [morningPhotoInput, setMorningPhotoInput] = useState<string>('');
  const [afternoonPhotoInput, setAfternoonPhotoInput] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [recordsMap, setRecordsMap] = useState<Record<string, JanitorDailyRecord>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_JANITOR_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });

  // ดึงรายชื่อนักการภารโรงจากคอลเลกชัน personnel อัตโนมัติ (ไม่รวมธุรการ)
  useEffect(() => {
    const q = query(collection(db, 'personnel'), orderBy('order', 'asc'));
    return onSnapshot(q, snap => {
      const supports: string[] = [];
      snap.forEach(d => {
        const data = d.data() as any;
        if (isJanitor(data) && data.name) {
          supports.push(data.name);
        }
      });
      if (supports.length > 0) {
        setStaffList(supports);
        setSelectedStaff(prev => (supports.includes(prev) ? prev : supports[0]));
      }
    });
  }, []);

  // ซิงค์ข้อมูลจาก Firestore คอลเลกชัน janitor_tasks
  useEffect(() => {
    return onSnapshot(collection(db, 'janitor_tasks'), snap => {
      const nextMap: Record<string, JanitorDailyRecord> = {};
      snap.forEach(d => {
        nextMap[d.id] = d.data() as JanitorDailyRecord;
      });
      if (Object.keys(nextMap).length > 0) {
        setRecordsMap(prev => {
          const merged = { ...prev, ...nextMap };
          try {
            localStorage.setItem(STORAGE_JANITOR_KEY, JSON.stringify(merged));
          } catch { /* ignore */ }
          return merged;
        });
      }
    });
  }, []);

  // One record per staff member per day. Records saved before this change used
  // `janitor_<date>` for whoever was selected; they stay where they are and are still
  // read and updated for that staff member, so no existing data moves or is lost.
  const legacyDocId = `janitor_${date}`;
  const supportPeople = usePersonnel('support');
  const docId = recordsMap[legacyDocId]?.staffName === selectedStaff
    ? legacyDocId
    : janitorDocId(date, selectedStaff);

  // A day nobody has recorded yet starts blank and "รอตรวจประเมิน", so printed reports never
  // show work or ratings that did not happen. The orders are the usual assignment and can be edited.
  const currentRecord: JanitorDailyRecord = useMemo(() => {
    if (recordsMap[docId]) return recordsMap[docId];
    return {
      id: docId,
      date,
      staffName: selectedStaff,
      assignedBy: DIRECTOR_NAME,
      morningOrder: 'ดูแลความสะอาดรอบอาคารเรียน ตัดแต่งกิ่งไม้ และตรวจเช็กระบบน้ำประปา',
      morningChecklist: [],
      morningDetail: '',
      morningPhotos: [],
      afternoonOrder: 'ดูแลความสะอาดห้องน้ำ โรงอาหารหลังมื้อเที่ยง และสำรวจซ่อมแซมอุปกรณ์ชำรุด',
      afternoonChecklist: [],
      afternoonDetail: '',
      afternoonPhotos: [],
      complianceStatus: 'รอตรวจประเมิน',
      qualityStars: 0,
      evaluatorName: '',
      evaluatorComment: '',
      updatedAt: Date.now(),
    };
  }, [recordsMap, docId, date, selectedStaff]);

  const saveRecord = async (patch: Partial<JanitorDailyRecord>) => {
    const next: JanitorDailyRecord = {
      ...currentRecord,
      ...patch,
      id: docId,
      date,
      staffId: personnelIdByName(supportPeople, currentRecord.staffName) || currentRecord.staffId || '',
      updatedAt: Date.now(),
    };
    const updatedMap = { ...recordsMap, [docId]: next };
    setRecordsMap(updatedMap);
    try {
      localStorage.setItem(STORAGE_JANITOR_KEY, JSON.stringify(updatedMap));
    } catch { /* ignore */ }
    try {
      await setDoc(doc(db, 'janitor_tasks', docId), next, { merge: true });
      setToastMsg('บันทึกข้อมูลการปฏิบัติงานลงระบบแล้ว');
    } catch {
      setToastMsg('บันทึกในเครื่องแล้ว');
    }
    setTimeout(() => setToastMsg(null), 2200);
  };

  const toggleChecklist = (period: 'morning' | 'afternoon', item: string) => {
    const field = period === 'morning' ? 'morningChecklist' : 'afternoonChecklist';
    const curList = currentRecord[field] || [];
    const nextList = curList.includes(item)
      ? curList.filter(x => x !== item)
      : [...curList, item];
    saveRecord({ [field]: nextList });
  };

  const addPhotoUrl = (period: 'morning' | 'afternoon') => {
    const raw = (period === 'morning' ? morningPhotoInput : afternoonPhotoInput).trim();
    if (!raw) return;
    if (period === 'morning') {
      saveRecord({ morningPhotos: [...currentRecord.morningPhotos, raw] });
      setMorningPhotoInput('');
    } else {
      saveRecord({ afternoonPhotos: [...currentRecord.afternoonPhotos, raw] });
      setAfternoonPhotoInput('');
    }
  };

  const removePhotoUrl = (period: 'morning' | 'afternoon', idx: number) => {
    if (period === 'morning') {
      saveRecord({ morningPhotos: currentRecord.morningPhotos.filter((_, i) => i !== idx) });
    } else {
      saveRecord({ afternoonPhotos: currentRecord.afternoonPhotos.filter((_, i) => i !== idx) });
    }
  };

  const monthPrefix = date.slice(0, 7);
  const monthRecords = useMemo(() => {
    const list = Object.values(recordsMap).filter(r => r.date.startsWith(monthPrefix));
    if (!list.some(r => r.date === date)) {
      list.push(currentRecord);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [recordsMap, monthPrefix, date, currentRecord]);

  const monthStats = useMemo(() => {
    const total = monthRecords.length;
    const fullPass = monthRecords.filter(r => r.complianceStatus === 'ตามคำสั่งครบถ้วน').length;
    const partial = monthRecords.filter(r => r.complianceStatus === 'ทำได้บางส่วน').length;
    const avgStars = total > 0
      ? monthRecords.reduce((s, r) => s + (r.qualityStars || 5), 0) / total
      : 5;
    const totalPhotos = monthRecords.reduce(
      (s, r) => s + (r.morningPhotos?.length || 0) + (r.afternoonPhotos?.length || 0),
      0
    );
    return { total, fullPass, partial, avgStars, totalPhotos };
  }, [monthRecords]);

  const exportMonthlyCsv = () => {
    const rows: Array<Array<string | number>> = [
      [`รายงานสรุปการปฏิบัติงาน นักการภารโรง ${SCHOOL_NAME}`],
      [`ประจำเดือน: ${monthPrefix}`, `ผู้ตรวจประเมิน: ${DIRECTOR_NAME}`],
      [],
      ['วันที่', 'ผู้ปฏิบัติงาน', 'คำสั่งงานเช้า', 'งานเช้าที่ทำ', 'จำนวนรูปเช้า', 'คำสั่งงานบ่าย', 'งานบ่ายที่ทำ', 'จำนวนรูปบ่าย', 'ผลการประเมินตามคำสั่ง', 'คะแนนดาว (เต็ม 5)', 'ความเห็น ผอ.'],
      ...monthRecords.map(r => [
        r.date,
        r.staffName,
        r.morningOrder,
        r.morningChecklist.join(' / ') + (r.morningDetail ? ` (${r.morningDetail})` : ''),
        r.morningPhotos.length,
        r.afternoonOrder,
        r.afternoonChecklist.join(' / ') + (r.afternoonDetail ? ` (${r.afternoonDetail})` : ''),
        r.afternoonPhotos.length,
        r.complianceStatus,
        r.qualityStars,
        r.evaluatorComment,
      ]),
    ];
    downloadCsvReport(`รายงานนักการภารโรง_${monthPrefix}.csv`, rows);
  };

  return (
    <SmartSchoolLayout pageTitle="ตรวจงานนักการภารโรง (เช้า-บ่าย)">
      <div className="no-print">
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wrench size={24} color="#EA580C" /> ระบบบันทึกและประเมินการปฏิบัติงาน นักการภารโรง (เช้า - บ่าย)
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              สั่งงานประจำวัน · แนบลิงก์รูปภาพผลงานเช้า-บ่าย · ผอ. ติ๊กประเมินว่าปฏิบัติงานได้ตามคำสั่งหรือไม่ พร้อมพิมพ์รายงาน A4
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {toastMsg && (
              <span style={{
                background: '#DCFCE7', color: '#15803D', padding: '8px 14px',
                borderRadius: 999, fontSize: '0.8rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCircle2 size={15} /> {toastMsg}
              </span>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                background: '#1E293B', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Printer size={15} /> พิมพ์ใบตรวจงานนักการ (A4)
            </button>
            <button
              type="button"
              onClick={exportMonthlyCsv}
              style={{
                background: '#15803D', color: 'white', border: 'none',
                borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Download size={15} /> ส่งออก Excel (CSV)
            </button>
          </div>
        </div>

        {/* KPI Summary Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #0284C7' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>บันทึกงานเดือนนี้ ({monthPrefix})</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginTop: 4 }}>{monthStats.total} วัน</div>
            <div style={{ fontSize: '0.73rem', color: '#0284C7', fontWeight: 700 }}>ผู้ปฏิบัติงาน: {currentRecord.staffName}</div>
          </div>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #16A34A' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>✅ ปฏิบัติได้ตามคำสั่งครบถ้วน</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D', marginTop: 4 }}>
              {monthStats.fullPass} / {monthStats.total} วัน
            </div>
            <div style={{ fontSize: '0.73rem', color: '#16A34A', fontWeight: 700 }}>
              คิดเป็น {monthStats.total ? Math.round((monthStats.fullPass / monthStats.total) * 100) : 100}%
            </div>
          </div>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #F59E0B' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>⭐ คะแนนความเรียบร้อยเฉลี่ย</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D97706', marginTop: 4 }}>
              {monthStats.avgStars.toFixed(1)} / 5.0 ดาว
            </div>
            <div style={{ fontSize: '0.73rem', color: '#B45309', fontWeight: 700 }}>ประเมินโดยผู้บริหารสถานศึกษา</div>
          </div>
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', border: '1px solid #E2E8F0', borderLeft: '5px solid #8B5CF6' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>📸 รูปภาพหลักฐานที่แนบเดือนนี้</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#6D28D9', marginTop: 4 }}>
              {monthStats.totalPhotos} รูป
            </div>
            <div style={{ fontSize: '0.73rem', color: '#7C3AED', fontWeight: 700 }}>ลิงก์รูปภาพ เช้า + บ่าย</div>
          </div>
        </div>

        {/* Date & Staff Selector Bar */}
        <div style={{
          background: '#FFFFFF', borderRadius: 14, padding: '14px 18px',
          marginBottom: 16, border: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
            <QuickDate value={date} onChange={setDate} color="#EA580C" label="วันที่ปฏิบัติงาน" />
            <div>
              <label style={lbl}>👷 ชื่อนักการภารโรง / ผู้ปฏิบัติงาน</label>
              <input
                list="janitor-staff-list"
                value={currentRecord.staffName}
                onChange={e => {
                  setSelectedStaff(e.target.value);
                  saveRecord({ staffName: e.target.value });
                }}
                style={{ ...inp, minWidth: 230, fontWeight: 800 }}
              />
              <datalist id="janitor-staff-list">
                {staffList.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              style={{
                padding: '9px 16px', borderRadius: 10, border: '1px solid #CBD5E1',
                background: activeTab === 'daily' ? '#EA580C' : '#FFFFFF',
                color: activeTab === 'daily' ? '#FFFFFF' : '#334155',
                fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ClipboardCheck size={16} /> บันทึก & ประเมินรายวัน ({fmtThai(date)})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                padding: '9px 16px', borderRadius: 10, border: '1px solid #CBD5E1',
                background: activeTab === 'history' ? '#0284C7' : '#FFFFFF',
                color: activeTab === 'history' ? '#FFFFFF' : '#334155',
                fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <CalendarIcon size={16} /> สรุปประวัติรายเดือน ({monthRecords.length} วัน)
            </button>
          </div>
        </div>

        {activeTab === 'daily' && (
          <>
            {/* Morning & Afternoon Two-Column Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18, marginBottom: 18 }}>
              {/* ================= MORNING CARD (ช่วงเช้า) ================= */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #FED7AA', overflow: 'hidden', boxShadow: '0 4px 14px rgba(234,88,12,0.05)' }}>
                <div style={{ background: 'linear-gradient(135deg,#F97316,#FB923C)', color: 'white', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: '1rem' }}>
                    <Sun size={20} /> ☀️ ภารกิจช่วงเช้า (07:00 – 12:00 น.)
                  </div>
                  <span style={{ background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800 }}>
                    แนบรูปแล้ว {currentRecord.morningPhotos.length} รูป
                  </span>
                </div>

                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ ...lbl, color: '#C2410C' }}>📌 คำสั่งงานช่วงเช้า (โดย ผอ. / หัวหน้างานอาคารสถานที่)</label>
                    <input
                      value={currentRecord.morningOrder}
                      onChange={e => saveRecord({ morningOrder: e.target.value })}
                      placeholder="ระบุงานที่มอบหมายเป็นพิเศษในช่วงเช้า..."
                      style={{ ...inp, width: '100%', background: '#FFF7ED', borderColor: '#FDBA74', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={lbl}>☑️ ติ๊กงานประจำช่วงเช้าที่ปฏิบัติแล้ว (คลิกเลือกได้หลายข้อ)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {MORNING_PRESETS.map(item => {
                        const checked = currentRecord.morningChecklist.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleChecklist('morning', item)}
                            style={{
                              textAlign: 'left', padding: '8px 12px', borderRadius: 10,
                              border: checked ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
                              background: checked ? '#F0FDF4' : '#F8FAFC',
                              color: checked ? '#166534' : '#475569',
                              fontWeight: checked ? 800 : 600, fontSize: '0.82rem', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                          >
                            <span>{item}</span>
                            <span>{checked ? '✅ ทำแล้ว' : '⬜'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>📝 รายละเอียดการปฏิบัติงานช่วงเช้าเพิ่มเติม</label>
                    <textarea
                      rows={2}
                      value={currentRecord.morningDetail}
                      onChange={e => saveRecord({ morningDetail: e.target.value })}
                      placeholder="สรุปผลการปฏิบัติงานช่วงเช้า..."
                      style={{ ...inp, width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  {/* Morning Photo Link Uploader */}
                  <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 12 }}>
                    <label style={{ ...lbl, color: '#0284C7' }}>
                      📸 อัปโหลดลิงก์รูปภาพผลงานช่วงเช้า (วางลิงก์ Google Drive / Google Photos / URL รูป)
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="url"
                        value={morningPhotoInput}
                        onChange={e => setMorningPhotoInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addPhotoUrl('morning')}
                        placeholder="วางลิงก์รูปภาพ เช่น https://drive.google.com/file/d/..."
                        style={{ ...inp, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => addPhotoUrl('morning')}
                        style={{
                          background: '#0284C7', color: 'white', border: 'none',
                          borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.82rem',
                        }}
                      >
                        <Plus size={15} /> เพิ่มรูป
                      </button>
                    </div>

                    {currentRecord.morningPhotos.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
                        {currentRecord.morningPhotos.map((url, idx) => (
                          <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: '#F8FAFC', position: 'relative' }}>
                            <div style={{ height: 90, background: '#E2E8F0' }}>
                              <DriveImage src={url} alt={`งานเช้า ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ padding: '4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                              <a href={url} target="_blank" rel="noreferrer" style={{ color: '#0284C7', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <ExternalLink size={11} /> ดูรูปเต็ม
                              </a>
                              <button
                                type="button"
                                onClick={() => removePhotoUrl('morning', idx)}
                                style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 2 }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ================= AFTERNOON CARD (ช่วงบ่าย) ================= */}
              <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1.5px solid #BAE6FD', overflow: 'hidden', boxShadow: '0 4px 14px rgba(2,132,199,0.05)' }}>
                <div style={{ background: 'linear-gradient(135deg,#0284C7,#38BDF8)', color: 'white', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: '1rem' }}>
                    <Sunset size={20} /> 🌇 ภารกิจช่วงบ่าย (13:00 – 16:30 น.)
                  </div>
                  <span style={{ background: 'rgba(255,255,255,0.22)', padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 800 }}>
                    แนบรูปแล้ว {currentRecord.afternoonPhotos.length} รูป
                  </span>
                </div>

                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ ...lbl, color: '#0369A1' }}>📌 คำสั่งงานช่วงบ่าย (โดย ผอ. / หัวหน้างานอาคารสถานที่)</label>
                    <input
                      value={currentRecord.afternoonOrder}
                      onChange={e => saveRecord({ afternoonOrder: e.target.value })}
                      placeholder="ระบุงานที่มอบหมายเป็นพิเศษในช่วงบ่าย..."
                      style={{ ...inp, width: '100%', background: '#F0F9FF', borderColor: '#7DD3FC', fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={lbl}>☑️ ติ๊กงานประจำช่วงบ่ายที่ปฏิบัติแล้ว (คลิกเลือกได้หลายข้อ)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {AFTERNOON_PRESETS.map(item => {
                        const checked = currentRecord.afternoonChecklist.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleChecklist('afternoon', item)}
                            style={{
                              textAlign: 'left', padding: '8px 12px', borderRadius: 10,
                              border: checked ? '1.5px solid #16A34A' : '1px solid #E2E8F0',
                              background: checked ? '#F0FDF4' : '#F8FAFC',
                              color: checked ? '#166534' : '#475569',
                              fontWeight: checked ? 800 : 600, fontSize: '0.82rem', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}
                          >
                            <span>{item}</span>
                            <span>{checked ? '✅ ทำแล้ว' : '⬜'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>📝 รายละเอียดการปฏิบัติงานช่วงบ่ายเพิ่มเติม</label>
                    <textarea
                      rows={2}
                      value={currentRecord.afternoonDetail}
                      onChange={e => saveRecord({ afternoonDetail: e.target.value })}
                      placeholder="สรุปผลการปฏิบัติงานช่วงบ่าย..."
                      style={{ ...inp, width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  {/* Afternoon Photo Link Uploader */}
                  <div style={{ borderTop: '1px dashed #CBD5E1', paddingTop: 12 }}>
                    <label style={{ ...lbl, color: '#0284C7' }}>
                      📸 อัปโหลดลิงก์รูปภาพผลงานช่วงบ่าย (วางลิงก์ Google Drive / Google Photos / URL รูป)
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="url"
                        value={afternoonPhotoInput}
                        onChange={e => setAfternoonPhotoInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addPhotoUrl('afternoon')}
                        placeholder="วางลิงก์รูปภาพ เช่น https://drive.google.com/file/d/..."
                        style={{ ...inp, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => addPhotoUrl('afternoon')}
                        style={{
                          background: '#0284C7', color: 'white', border: 'none',
                          borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.82rem',
                        }}
                      >
                        <Plus size={15} /> เพิ่มรูป
                      </button>
                    </div>

                    {currentRecord.afternoonPhotos.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
                        {currentRecord.afternoonPhotos.map((url, idx) => (
                          <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: '#F8FAFC', position: 'relative' }}>
                            <div style={{ height: 90, background: '#E2E8F0' }}>
                              <DriveImage src={url} alt={`งานบ่าย ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                            <div style={{ padding: '4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                              <a href={url} target="_blank" rel="noreferrer" style={{ color: '#0284C7', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                <ExternalLink size={11} /> ดูรูปเต็ม
                              </a>
                              <button
                                type="button"
                                onClick={() => removePhotoUrl('afternoon', idx)}
                                style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 2 }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ================= DIRECTOR'S EVALUATION PANEL ================= */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 18,
              border: '2px solid #0F172A',
              padding: 22,
              boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                    📋 ส่วนการตรวจรับงานและประเมินผลตามคำสั่ง (สำหรับผู้อำนวยการ / ผู้ตรวจงาน)
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: 2 }}>
                    คลิกติ๊กประเมินว่านักการภารโรงปฏิบัติงานได้ตรงตามคำสั่งหรือไม่ พร้อมให้ดาวความเรียบร้อย
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>ระดับความเรียบร้อย:</span>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => saveRecord({ qualityStars: star })}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                        color: star <= currentRecord.qualityStars ? '#F59E0B' : '#CBD5E1',
                      }}
                    >
                      <Star size={24} fill={star <= currentRecord.qualityStars ? '#F59E0B' : 'none'} />
                    </button>
                  ))}
                  <span style={{ fontWeight: 900, color: '#D97706', marginLeft: 4 }}>
                    ({currentRecord.qualityStars}/5)
                  </span>
                </div>
              </div>

              {/* 3 Big Evaluation Tick Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => saveRecord({
                    complianceStatus: 'ตามคำสั่งครบถ้วน',
                    qualityStars: 5,
                    evaluatorComment: 'ปฏิบัติงานได้เรียบร้อย รวดเร็ว และครบถ้วนตามคำสั่งที่มอบหมายดีมาก',
                  })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: currentRecord.complianceStatus === 'ตามคำสั่งครบถ้วน' ? '2.5px solid #15803D' : '1px solid #CBD5E1',
                    background: currentRecord.complianceStatus === 'ตามคำสั่งครบถ้วน' ? '#DCFCE7' : '#F8FAFC',
                    color: '#166534',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <CheckCircle2 size={22} color="#15803D" />
                  <div style={{ textAlign: 'left' }}>
                    <div>✅ ปฏิบัติได้ตามคำสั่งครบถ้วน</div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, opacity: 0.85 }}>งานเช้าและบ่ายเรียบร้อย 100%</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => saveRecord({
                    complianceStatus: 'ทำได้บางส่วน',
                    qualityStars: 3,
                    evaluatorComment: 'ปฏิบัติงานได้ตามคำสั่งบางส่วน ควรเก็บรายละเอียดเพิ่มเติมในจุดที่มอบหมาย',
                  })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: currentRecord.complianceStatus === 'ทำได้บางส่วน' ? '2.5px solid #D97706' : '1px solid #CBD5E1',
                    background: currentRecord.complianceStatus === 'ทำได้บางส่วน' ? '#FEF3C7' : '#F8FAFC',
                    color: '#92400E',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={22} color="#D97706" />
                  <div style={{ textAlign: 'left' }}>
                    <div>⚠️ ปฏิบัติได้บางส่วน / แก้ไขเพิ่ม</div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, opacity: 0.85 }}>ต้องเก็บงานต่อให้ครบตามสั่ง</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => saveRecord({
                    complianceStatus: 'ไม่ตรงตามคำสั่ง',
                    qualityStars: 1,
                    evaluatorComment: 'ยังปฏิบัติงานไม่ตรงตามคำสั่งที่มอบหมาย ให้ดำเนินการแก้ไขโดยด่วน',
                  })}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: currentRecord.complianceStatus === 'ไม่ตรงตามคำสั่ง' ? '2.5px solid #DC2626' : '1px solid #CBD5E1',
                    background: currentRecord.complianceStatus === 'ไม่ตรงตามคำสั่ง' ? '#FEE2E2' : '#F8FAFC',
                    color: '#991B1B',
                    fontWeight: 900,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <XCircle size={22} color="#DC2626" />
                  <div style={{ textAlign: 'left' }}>
                    <div>❌ ไม่ตรงตามคำสั่ง / ยังไม่เสร็จ</div>
                    <div style={{ fontSize: '0.73rem', fontWeight: 700, opacity: 0.85 }}>แจ้งเตือนให้ปฏิบัติใหม่</div>
                  </div>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>💬 ข้อเสนอแนะ / คำสั่งการเพิ่มเติมจาก ผู้อำนวยการ</label>
                  <input
                    value={currentRecord.evaluatorComment}
                    onChange={e => saveRecord({ evaluatorComment: e.target.value })}
                    style={{ ...inp, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={lbl}>👤 ผู้ตรวจประเมิน</label>
                  <input
                    value={currentRecord.evaluatorName || userName}
                    onChange={e => saveRecord({ evaluatorName: e.target.value })}
                    style={{ ...inp, width: '100%', fontWeight: 800 }}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: MONTHLY HISTORY TABLE ================= */}
        {activeTab === 'history' && (
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 20, border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 900, color: '#0F172A' }}>
              📅 สรุปประวัติการปฏิบัติงาน นักการภารโรง ประจำเดือน {monthPrefix}
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#0F172A', color: 'white' }}>
                    <th style={{ padding: 10, textAlign: 'center' }}>วันที่</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>ภารกิจช่วงเช้า</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>ภารกิจช่วงบ่าย</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>รูปหลักฐาน</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>ผลการประเมินตามคำสั่ง</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>คะแนนดาว</th>
                    <th style={{ padding: 10, textAlign: 'center' }}>เปิดดู</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRecords.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 800 }}>{fmtThai(r.date)}</td>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 800, color: '#C2410C' }}>คำสั่ง: {r.morningOrder}</div>
                        <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                          ทำแล้ว {r.morningChecklist.length} รายการ · {r.morningDetail}
                        </div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 800, color: '#0369A1' }}>คำสั่ง: {r.afternoonOrder}</div>
                        <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                          ทำแล้ว {r.afternoonChecklist.length} รายการ · {r.afternoonDetail}
                        </div>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 800, color: '#6D28D9' }}>
                        <ImageIcon size={14} style={{ verticalAlign: 'middle' }} /> {(r.morningPhotos?.length || 0) + (r.afternoonPhotos?.length || 0)} รูป
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 999, fontWeight: 800, fontSize: '0.75rem',
                          background: r.complianceStatus === 'ตามคำสั่งครบถ้วน' ? '#DCFCE7' : r.complianceStatus === 'ทำได้บางส่วน' ? '#FEF3C7' : '#FEE2E2',
                          color: r.complianceStatus === 'ตามคำสั่งครบถ้วน' ? '#166534' : r.complianceStatus === 'ทำได้บางส่วน' ? '#92400E' : '#991B1B',
                        }}>
                          {r.complianceStatus}
                        </span>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 900, color: '#D97706' }}>
                        ⭐ {r.qualityStars} / 5
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setDate(r.date);
                            setActiveTab('daily');
                          }}
                          style={{
                            background: '#F1F5F9', border: '1px solid #CBD5E1',
                            borderRadius: 6, padding: '5px 10px', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
                          }}
                        >
                          เปิดตรวจ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ================= OFFICIAL A4 PRINT SHEET FOR JANITOR DAILY REPORT ================= */}
      <div className="only-print-janitor print-area">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img
            src={`${import.meta.env.BASE_URL}school_logo_kmd.png`}
            alt="ตราโรงเรียน"
            style={{ width: 58, height: 58, objectFit: 'contain', margin: '0 auto 4px' }}
          />
          <div style={{ fontSize: '15pt', fontWeight: 800 }}>
            แบบรายงานและประเมินผลการปฏิบัติงานของ นักการภารโรงประจำวัน (เช้า - บ่าย)
          </div>
          <div style={{ fontSize: '11.5pt', fontWeight: 700 }}>
            {SCHOOL_NAME} &nbsp; {SCHOOL_AFFILIATION}
          </div>
          <div style={{ fontSize: '11pt', fontWeight: 700, marginTop: 3 }}>
            ประจำวันที่ {fmtThai(date)} &nbsp;|&nbsp; ผู้ปฏิบัติงาน: {currentRecord.staffName}
          </div>
        </div>

        <table className="janitor-print-table" style={{ marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={{ width: '16%' }}>ช่วงเวลา</th>
              <th style={{ width: '30%' }}>คำสั่งงานที่ได้รับมอบหมาย</th>
              <th style={{ width: '38%' }}>รายการปฏิบัติงานจริง</th>
              <th style={{ width: '16%' }}>หลักฐานรูปภาพ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 800 }}>
                ช่วงเช้า<br />(07:00 - 12:00 น.)
              </td>
              <td>{currentRecord.morningOrder}</td>
              <td>
                <ul style={{ margin: '0 0 4px 16px', padding: 0 }}>
                  {currentRecord.morningChecklist.map(c => <li key={c}>{c}</li>)}
                </ul>
                <div><b>สรุป:</b> {currentRecord.morningDetail}</div>
              </td>
              <td style={{ textAlign: 'center' }}>
                แนบลิงก์รูปภาพ<br /><b>{currentRecord.morningPhotos.length} รูป</b>
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 800 }}>
                ช่วงบ่าย<br />(13:00 - 16:30 น.)
              </td>
              <td>{currentRecord.afternoonOrder}</td>
              <td>
                <ul style={{ margin: '0 0 4px 16px', padding: 0 }}>
                  {currentRecord.afternoonChecklist.map(c => <li key={c}>{c}</li>)}
                </ul>
                <div><b>สรุป:</b> {currentRecord.afternoonDetail}</div>
              </td>
              <td style={{ textAlign: 'center' }}>
                แนบลิงก์รูปภาพ<br /><b>{currentRecord.afternoonPhotos.length} รูป</b>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Evaluation Result Box */}
        <div style={{ border: '1.5px solid #000', padding: '10px 14px', marginBottom: 22, fontSize: '11pt', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: 4 }}>
            ผลการตรวจประเมินการปฏิบัติงานตามคำสั่ง (โดยผู้บริหารสถานศึกษา)
          </div>
          <div>
            <b>ผลการประเมิน:</b> &nbsp;
            [ {currentRecord.complianceStatus === 'ตามคำสั่งครบถ้วน' ? '✓' : ' '} ] ปฏิบัติงานได้ตามคำสั่งครบถ้วน &nbsp;&nbsp;
            [ {currentRecord.complianceStatus === 'ทำได้บางส่วน' ? '✓' : ' '} ] ปฏิบัติได้บางส่วน &nbsp;&nbsp;
            [ {currentRecord.complianceStatus === 'ไม่ตรงตามคำสั่ง' ? '✓' : ' '} ] ไม่ตรงตามคำสั่ง
          </div>
          <div>
            <b>ระดับคุณภาพความเรียบร้อย:</b> {currentRecord.qualityStars} / 5 ดาว
          </div>
          <div>
            <b>ข้อเสนอแนะ / คำสั่งการของผู้อำนวยการ:</b> {currentRecord.evaluatorComment}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, textAlign: 'center', fontSize: '11pt', lineHeight: 1.7 }}>
          <div>
            <div>ลงชื่อ .......................................................... ผู้ปฏิบัติงาน</div>
            <div style={{ marginTop: 4 }}>({currentRecord.staffName})</div>
            <div>ตำแหน่ง นักการภารโรง</div>
          </div>
          <div>
            <div>ลงชื่อ .......................................................... ผู้ตรวจประเมิน/รับรอง</div>
            <div style={{ fontWeight: 800, marginTop: 4 }}>({DIRECTOR_NAME})</div>
            <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
          </div>
        </div>
      </div>

      <style>{`
        .only-print-janitor { display: none; }
        .janitor-print-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
        .janitor-print-table th, .janitor-print-table td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
        .janitor-print-table th { background: #F1F5F9; font-weight: 800; text-align: center; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .no-print { display: none !important; }
          .only-print-janitor {
            display: block !important;
            font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
            color: #000;
          }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtThai = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[(m || 1) - 1]} ${(y || 2026) + 543}`;
};

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.76rem',
  fontWeight: 800,
  color: '#334155',
  marginBottom: 4,
};

const inp: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #CBD5E1',
  fontSize: '0.86rem',
  color: '#0F172A',
};
