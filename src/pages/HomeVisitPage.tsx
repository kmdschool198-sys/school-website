import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useSchoolRoster } from '../utils/useSchoolRoster';
import { Home, Printer, Download, CheckCircle2, HeartHandshake, ExternalLink } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import DriveImage from '../components/DriveImage';
import { useTeacherAuth } from '../utils/teacherAuth';
import { downloadCsvReport } from '../utils/csvReport';
import { SCHOOL_NAME } from '../config/siteLinks';

const DIRECTOR_NAME = 'นายปรัชญา ปรางค์ชัยภูมิ';
const STORAGE_HOME_VISIT_KEY = 'kmd_home_visits_v1';

export interface HomeVisitRecord {
  studentCode: string;
  visited: boolean;
  visitDate: string;
  economicStatus: 'ปกติ' | 'ยากจน' | 'ยากจนพิเศษ (กสศ.)';
  livingWith: 'บิดา-มารดา' | 'บิดาหรือมารดาเลี้ยงเดี่ยว' | 'ปู่ย่าตายาย/ญาติ';
  scholarshipNeed: boolean;
  photoUrl: string;
  note: string;
  updatedAt: number;
}

export default function HomeVisitPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="🏠 ระบบบันทึกการเยี่ยมบ้านนักเรียน & คัดกรองทุน กสศ." />;
  }
  return <HomeVisitContent />;
}

function HomeVisitContent() {
  const { classes: rosters } = useSchoolRoster();
  const [selectedClassId, setSelectedClassId] = useState<string>('m1_1');
  const [records, setRecords] = useState<Record<string, HomeVisitRecord>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HOME_VISIT_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {};
  });
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'home_visits'), snap => {
      if (snap.exists() && snap.data()?.records) {
        const remote = snap.data().records as Record<string, HomeVisitRecord>;
        setRecords(prev => {
          const merged = { ...prev, ...remote };
          try { localStorage.setItem(STORAGE_HOME_VISIT_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
          return merged;
        });
      }
    });
  }, []);

  const currentClass = useMemo(
    () => rosters.find(c => c.classId === selectedClassId) || rosters[0],
    [rosters, selectedClassId]
  );

  const updateVisit = async (studentCode: string, patch: Partial<HomeVisitRecord>) => {
    const existing: HomeVisitRecord = records[studentCode] || {
      studentCode,
      visited: true,
      visitDate: new Date().toISOString().slice(0, 10),
      economicStatus: 'ปกติ',
      livingWith: 'บิดา-มารดา',
      scholarshipNeed: false,
      photoUrl: '',
      note: 'ครอบครัวดูแลเอาใจใส่ดี',
      updatedAt: Date.now(),
    };
    const nextRec: HomeVisitRecord = { ...existing, ...patch, updatedAt: Date.now() };
    const nextMap = { ...records, [studentCode]: nextRec };
    setRecords(nextMap);
    try { localStorage.setItem(STORAGE_HOME_VISIT_KEY, JSON.stringify(nextMap)); } catch { /* ignore */ }
    try {
      await setDoc(doc(db, 'config', 'home_visits'), { records: nextMap, updatedAt: Date.now() }, { merge: true });
      setSavedToast('บันทึกข้อมูลการเยี่ยมบ้านแล้ว');
    } catch {
      setSavedToast('บันทึกในเครื่องแล้ว');
    }
    setTimeout(() => setSavedToast(null), 2000);
  };

  const exportVisitCsv = () => {
    if (!currentClass) return;
    const rows: Array<Array<string | number>> = [
      [`รายงานสรุปการเยี่ยมบ้านนักเรียนและคัดกรองความยากจน ชั้น ${currentClass.fullClassName}`],
      ['เลขที่', 'รหัส', 'ชื่อ-สกุล', 'ผู้ปกครอง (DMC)', 'ที่อยู่ (DMC)', 'สถานะเยี่ยมบ้าน', 'สถานะเศรษฐกิจ', 'อาศัยอยู่กับ', 'ขอรับทุนอุดหนุน', 'หมายเหตุ'],
      ...currentClass.students.map(st => {
        const rec = records[st.code];
        return [
          st.no, st.code, st.name, st.guardianName || '-', st.address || '-',
          rec?.visited !== false ? 'เยี่ยมแล้ว' : 'รอเยี่ยม',
          rec?.economicStatus || 'ปกติ',
          rec?.livingWith || 'บิดา-มารดา',
          rec?.scholarshipNeed ? 'ต้องการทุน' : '-',
          rec?.note || 'ปกติ',
        ];
      }),
    ];
    downloadCsvReport(`เยี่ยมบ้าน_${currentClass.shortClass}.csv`, rows);
  };

  const stats = useMemo(() => {
    if (!currentClass) return { total: 0, visited: 0, poor: 0, needScholarship: 0 };
    let visited = 0, poor = 0, needScholarship = 0;
    currentClass.students.forEach(st => {
      const r = records[st.code];
      if (!r || r.visited !== false) visited += 1;
      if (r?.economicStatus === 'ยากจน' || r?.economicStatus === 'ยากจนพิเศษ (กสศ.)') poor += 1;
      if (r?.scholarshipNeed) needScholarship += 1;
    });
    return { total: currentClass.students.length, visited, poor, needScholarship };
  }, [currentClass, records]);

  if (!currentClass) return null;

  return (
    <SmartSchoolLayout pageTitle="ระบบเยี่ยมบ้านนักเรียน & คัดกรองทุน">
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Home size={24} color="#059669" /> ระบบบันทึกการเยี่ยมบ้านนักเรียน & คัดกรองนักเรียนยากจนพิเศษ (กสศ.)
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: 2 }}>
              ดึงชื่อผู้ปกครองและที่อยู่จากทะเบียน DMC อัตโนมัติ · แนบลิงก์รูปถ่ายเยี่ยมบ้าน · พิมพ์สรุปรายห้อง A4
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {savedToast && (
              <span style={{ background: '#DCFCE7', color: '#15803D', padding: '8px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={14} /> {savedToast}
              </span>
            )}
            <button onClick={() => window.print()} style={{ background: '#1E293B', color: 'white', border: 'none', borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Printer size={15} /> พิมพ์สรุปเยี่ยมบ้าน (A4)
            </button>
            <button onClick={exportVisitCsv} style={{ background: '#15803D', color: 'white', border: 'none', borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={15} /> ส่งออก Excel (CSV)
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'white', padding: '14px 16px', borderRadius: 14, borderLeft: '5px solid #0284C7', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>นักเรียนในชั้น {currentClass.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A' }}>{stats.total} คน</div>
          </div>
          <div style={{ background: 'white', padding: '14px 16px', borderRadius: 14, borderLeft: '5px solid #16A34A', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>🏠 เยี่ยมบ้านแล้ว</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D' }}>{stats.visited} / {stats.total} คน</div>
          </div>
          <div style={{ background: 'white', padding: '14px 16px', borderRadius: 14, borderLeft: '5px solid #EA580C', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>📉 ครอบครัวยากจน / ยากจนพิเศษ</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#C2410C' }}>{stats.poor} คน</div>
          </div>
          <div style={{ background: 'white', padding: '14px 16px', borderRadius: 14, borderLeft: '5px solid #8B5CF6', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>🎓 เสนอขอรับทุนอุดหนุน</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#6D28D9' }}>{stats.needScholarship} คน</div>
          </div>
        </div>

        {/* Class Picker */}
        <div style={{ background: 'white', padding: '14px 18px', borderRadius: 14, marginBottom: 16, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 900, color: '#0F172A' }}>🏫 เลือกชั้นเรียน:</label>
          <select
            value={currentClass.classId}
            onChange={e => setSelectedClassId(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontWeight: 800 }}
          >
            {rosters.map(c => (
              <option key={c.classId} value={c.classId}>ชั้น {c.fullClassName} ({c.label}) — {c.totalCount} คน</option>
            ))}
          </select>
          <span style={{ fontSize: '0.82rem', color: '#64748B' }}>ครูประจำชั้น: <b>{currentClass.homeroomTeacher}</b></span>
        </div>

        {/* Student Home Visit Table */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#0F172A', color: 'white' }}>
                  <th style={{ padding: 10, width: 45 }}>ที่</th>
                  <th style={{ padding: 10, textAlign: 'left', width: 220 }}>ชื่อ-สกุล / ผู้ปกครอง & ที่อยู่ (DMC)</th>
                  <th style={{ padding: 10, width: 135 }}>สถานะเศรษฐกิจ</th>
                  <th style={{ padding: 10, width: 150 }}>อาศัยอยู่กับ</th>
                  <th style={{ padding: 10, width: 100 }}>ขอรับทุน</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>ลิงก์รูปถ่ายเยี่ยมบ้าน & หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {currentClass.students.map(st => {
                  const rec = records[st.code] || {
                    studentCode: st.code,
                    visited: true,
                    visitDate: '',
                    economicStatus: 'ปกติ',
                    livingWith: 'บิดา-มารดา',
                    scholarshipNeed: false,
                    photoUrl: '',
                    note: 'ครอบครัวดูแลเอาใจใส่ดี',
                    updatedAt: 0,
                  };
                  return (
                    <tr key={st.code} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: 10, textAlign: 'center', fontWeight: 800 }}>{st.no}</td>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontWeight: 900, color: '#0F172A' }}>{st.name} <span style={{ color: '#64748B', fontSize: '0.75rem' }}>({st.code})</span></div>
                        <div style={{ fontSize: '0.74rem', color: '#0369A1', fontWeight: 700 }}>ผู้ปกครอง: {st.guardianName || '-'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>📍 {st.address || '-'}</div>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <select
                          value={rec.economicStatus}
                          onChange={e => updateVisit(st.code, { economicStatus: e.target.value as any })}
                          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.78rem' }}
                        >
                          <option value="ปกติ">ปกติ</option>
                          <option value="ยากจน">ยากจน</option>
                          <option value="ยากจนพิเศษ (กสศ.)">ยากจนพิเศษ (กสศ.)</option>
                        </select>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <select
                          value={rec.livingWith}
                          onChange={e => updateVisit(st.code, { livingWith: e.target.value as any })}
                          style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 700, fontSize: '0.78rem' }}
                        >
                          <option value="บิดา-มารดา">บิดา-มารดา</option>
                          <option value="บิดาหรือมารดาเลี้ยงเดี่ยว">พ่อ/แม่เลี้ยงเดี่ยว</option>
                          <option value="ปู่ย่าตายาย/ญาติ">ปู่ย่าตายาย/ญาติ</option>
                        </select>
                      </td>
                      <td style={{ padding: 10, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => updateVisit(st.code, { scholarshipNeed: !rec.scholarshipNeed })}
                          style={{
                            padding: '5px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                            fontWeight: 800, fontSize: '0.74rem',
                            background: rec.scholarshipNeed ? '#EDE9FE' : '#F1F5F9',
                            color: rec.scholarshipNeed ? '#6D28D9' : '#64748B',
                          }}
                        >
                          <HeartHandshake size={13} style={{ verticalAlign: 'middle' }} /> {rec.scholarshipNeed ? 'ขอรับทุน ✓' : 'ปกติ'}
                        </button>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {rec.photoUrl && (
                            <div style={{ width: 42, height: 42, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: '1px solid #CBD5E1' }}>
                              <DriveImage src={rec.photoUrl} alt={st.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <input
                              type="url"
                              value={rec.photoUrl}
                              onChange={e => updateVisit(st.code, { photoUrl: e.target.value })}
                              placeholder="วางลิงก์รูปถ่ายเยี่ยมบ้าน (Google Drive)..."
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.76rem' }}
                            />
                            <input
                              type="text"
                              value={rec.note}
                              onChange={e => updateVisit(st.code, { note: e.target.value })}
                              placeholder="บันทึกสภาพครอบครัว..."
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.76rem' }}
                            />
                          </div>
                          {rec.photoUrl && (
                            <a href={rec.photoUrl} target="_blank" rel="noreferrer" style={{ color: '#0284C7' }} title="เปิดดูรูปเต็ม">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print A4 Sheet */}
      <div className="only-print-visit print-area">
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: '14pt', fontWeight: 800 }}>
            แบบสรุปรายงานการเยี่ยมบ้านนักเรียนและคัดกรองความยากจน (ระบบดูแลช่วยเหลือนักเรียน)
          </div>
          <div style={{ fontSize: '11pt', fontWeight: 700 }}>
            {SCHOOL_NAME} &nbsp;|&nbsp; ชั้น {currentClass.fullClassName} ({currentClass.label}) &nbsp;|&nbsp; ครูประจำชั้น: {currentClass.homeroomTeacher}
          </div>
        </div>
        <table className="visit-print-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>ที่</th>
              <th style={{ width: '22%' }}>ชื่อ-สกุล</th>
              <th style={{ width: '18%' }}>ชื่อผู้ปกครอง</th>
              <th style={{ width: '14%' }}>สถานะเศรษฐกิจ</th>
              <th style={{ width: '15%' }}>อาศัยอยู่กับ</th>
              <th style={{ width: '10%' }}>ขอรับทุน</th>
              <th style={{ width: '16%' }}>ผลการเยี่ยมบ้าน</th>
            </tr>
          </thead>
          <tbody>
            {currentClass.students.map(st => {
              const r = records[st.code];
              return (
                <tr key={st.code}>
                  <td style={{ textAlign: 'center' }}>{st.no}</td>
                  <td>{st.name}</td>
                  <td>{st.guardianName || '-'}</td>
                  <td style={{ textAlign: 'center' }}>{r?.economicStatus || 'ปกติ'}</td>
                  <td style={{ textAlign: 'center' }}>{r?.livingWith || 'บิดา-มารดา'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{r?.scholarshipNeed ? '✓' : '-'}</td>
                  <td>{r?.note || 'เรียบร้อยดี'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, textAlign: 'center', fontSize: '10.5pt' }}>
          <div>
            <div>ลงชื่อ .......................................................... ครูประจำชั้น</div>
            <div>({currentClass.homeroomTeacher})</div>
          </div>
          <div>
            <div>ลงชื่อ .......................................................... ผู้อำนวยการโรงเรียน</div>
            <div style={{ fontWeight: 800 }}>({DIRECTOR_NAME})</div>
            <div>ผู้อำนวยการ{SCHOOL_NAME}</div>
          </div>
        </div>
      </div>

      <style>{`
        .only-print-visit { display: none; }
        .visit-print-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        .visit-print-table th, .visit-print-table td { border: 1px solid #000; padding: 4px 6px; }
        .visit-print-table th { background: #F1F5F9; font-weight: 800; text-align: center; }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          .only-print-visit { display: block !important; font-family: 'Sarabun', sans-serif; color: #000; }
        }
      `}</style>
    </SmartSchoolLayout>
  );
}
