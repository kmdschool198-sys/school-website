import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Printer } from 'lucide-react';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import type { Club, ClubAttendanceDoc } from '../data/clubs';

export default function ClubPrintPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🖨️ พิมพ์แบบบันทึกชุมนุม" />;
  return <App />;
}

function App() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear() + 543);
  const [term, setTerm] = useState<1 | 2>(1);
  const [attendance, setAttendance] = useState<ClubAttendanceDoc[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'clubs'), snap => {
      const arr: Club[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setClubs(arr);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'club_attendance'), snap => {
      const arr: ClubAttendanceDoc[] = [];
      snap.forEach(d => arr.push(d.data() as ClubAttendanceDoc));
      setAttendance(arr);
    });
  }, []);

  useEffect(() => {
    if (!clubId && clubs.length) setClubId(clubs[0].id);
  }, [clubs]);

  const current = clubs.find(c => c.id === clubId);

  // Get all attendance dates for this club, sorted
  const dates = useMemo(() => {
    if (!current) return [];
    return attendance
      .filter(a => a.clubId === current.id)
      .map(a => a.date)
      .sort()
      .slice(0, 10);  // form supports up to 10
  }, [attendance, current]);

  const attMap = useMemo(() => {
    const m: Record<string, ClubAttendanceDoc> = {};
    attendance.forEach(a => { if (current && a.clubId === current.id) m[a.date] = a; });
    return m;
  }, [attendance, current]);

  const presentCount = (studentId: string) =>
    dates.filter(d => attMap[d]?.records?.[studentId]?.status === 'present').length;

  const totalMembers = current?.members.length || 0;
  const passed = current?.members.filter(m => presentCount(m.studentId) >= dates.length * 0.8).length || 0;
  const failed = totalMembers - passed;

  if (!current) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
        ยังไม่มีชุมนุมในระบบ
      </div>
    );
  }

  const fmtDateShort = (iso: string) => {
    const [, m, d] = iso.split('-');
    return `${Number(d)}/${Number(m)}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header className="no-print" style={{ background: 'linear-gradient(135deg,#3B82F6,#60A5FA)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/teacher-hub" style={lnk}><ChevronLeft size={16} />Hub</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>🖨️ แบบบันทึกกิจกรรมชุมนุม</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>3 หน้า: ปก + ทะเบียนเวลา + ประเมินผล</div>
          </div>
          <select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={term} onChange={e => setTerm(Number(e.target.value) as 1 | 2)} style={inp}>
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
          </select>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inp, width: 80 }} />
          <button onClick={() => window.print()} style={btnPrint}><Printer size={16} /> พิมพ์</button>
        </div>
      </header>

      <div className="print-area" style={{ maxWidth: '210mm', margin: '14px auto' }}>
        {/* COVER */}
        <div style={page}>
          <div style={{ textAlign: 'center', marginTop: '4cm' }}>
            <h2 style={{ fontWeight: 900, fontSize: '2rem', margin: '0 0 1rem' }}>แบบบันทึกกิจกรรมชุมนุม</h2>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, margin: '2rem 0', color: '#1E40AF' }}>
              กิจกรรม <u>{current.name}</u>
            </div>
            <div style={{ fontSize: '1.05rem', margin: '0.5rem 0' }}>
              ครูที่ปรึกษาชุมนุม: <b>{current.advisor}</b>
            </div>
            <div style={{ fontSize: '1.05rem', marginTop: '4rem' }}>
              <div>โรงเรียนบ้านคลองมดแดง</div>
              <div>สำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2</div>
              <div>สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน</div>
              <div>กระทรวงศึกษาธิการ</div>
            </div>
            <div style={{ marginTop: '3rem', fontSize: '1.1rem', fontWeight: 700 }}>
              ภาคเรียนที่ {term} ปีการศึกษา {year}
            </div>
          </div>
        </div>

        {/* SUMMARY PAGE */}
        <div style={page}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 900 }}>แบบบันทึกผลการประเมินกิจกรรมพัฒนาผู้เรียน</h3>
            <div>โรงเรียนบ้านคลองมดแดง</div>
            <div style={{ margin: '14px 0', fontSize: '1.1rem' }}>กิจกรรม <b>{current.name}</b></div>
            <div>ภาคเรียนที่ {term} ปีการศึกษา {year}</div>
            <div>ครูประจำชุมนุม: {current.advisor}</div>
          </div>
          <h4 style={{ textAlign: 'center', margin: '20px 0' }}>สรุปผลการประเมินกิจกรรมชุมนุม</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th style={th}>จำนวนนักเรียนทั้งหมด (คน)</th>
                <th colSpan={2} style={th}>ผลการประเมิน</th>
                <th style={th}>หมายเหตุ</th>
              </tr>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={th}></th>
                <th style={th}>ผ่าน (คน)</th>
                <th style={th}>ไม่ผ่าน (คน)</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...td, fontSize: '1.2rem', fontWeight: 900 }}>{totalMembers}</td>
                <td style={{ ...td, fontSize: '1.2rem', fontWeight: 900, color: '#10B981' }}>{passed}</td>
                <td style={{ ...td, fontSize: '1.2rem', fontWeight: 900, color: '#EF4444' }}>{failed}</td>
                <td style={td}></td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '12px' }}>
            <div><div style={{ marginTop: 50, paddingTop: 4 }}>
              ลงชื่อ ........................................ <br/>
              (.....................................................) <br/>
              ครูประจำชุมนุม
            </div></div>
            <div><div style={{ marginTop: 50, paddingTop: 4 }}>
              ลงชื่อ ........................................ <br/>
              (.....................................................) <br/>
              ผู้อำนวยการสถานศึกษา
            </div></div>
          </div>
        </div>

        {/* ATTENDANCE TABLE PAGE */}
        <div style={page}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <h4 style={{ fontWeight: 900, margin: 0 }}>ตารางบันทึกเวลาของการเข้าร่วมกิจกรรม</h4>
            <div style={{ fontSize: '0.95rem' }}>ภาคเรียนที่ {term} ปีการศึกษา {year} · โรงเรียนบ้านคลองมดแดง</div>
            <div style={{ fontSize: '0.92rem' }}>ชุมนุม <b>{current.name}</b></div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th rowSpan={2} style={{ ...th, width: '4%' }}>ลำดับ</th>
                <th rowSpan={2} style={{ ...th, width: '32%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ-สกุล</th>
                <th rowSpan={2} style={{ ...th, width: '6%' }}>ชั้น</th>
                <th colSpan={10} style={th}>เวลาเข้าร่วมกิจกรรม (วัน/เดือน)</th>
                <th rowSpan={2} style={{ ...th, width: '8%', background: '#FFEDD5' }}>รวม</th>
              </tr>
              <tr style={{ background: '#F8FAFC' }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <th key={i} style={{ ...th, fontSize: '9px' }}>
                    {dates[i] ? fmtDateShort(dates[i]) : i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.members.map((m, i) => {
                const n = presentCount(m.studentId);
                return (
                  <tr key={m.studentId}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, textAlign: 'left', paddingLeft: 6 }}>{m.name}</td>
                    <td style={td}>{m.classLabel.split('/')[0]}</td>
                    {Array.from({ length: 10 }, (_, j) => {
                      const d = dates[j];
                      const status = d ? attMap[d]?.records?.[m.studentId]?.status : undefined;
                      const mark = status === 'present' ? '✓' : status === 'absent' ? '✗' : status === 'leave' ? 'ล' : '';
                      const color = status === 'present' ? '#16A34A' : status === 'absent' ? '#DC2626' : status === 'leave' ? '#D97706' : '#0F172A';
                      return <td key={j} style={{ ...td, color, fontWeight: 800 }}>{mark}</td>;
                    })}
                    <td style={{ ...td, fontWeight: 900, background: '#FFFBEB' }}>{n}</td>
                  </tr>
                );
              })}
              {current.members.length === 0 && <tr><td colSpan={14} style={{ ...td, padding: 30, color: '#94A3B8' }}>ยังไม่มีสมาชิก</td></tr>}
            </tbody>
          </table>
        </div>

        {/* EVALUATION PAGE */}
        <div style={page}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <h4 style={{ fontWeight: 900, margin: 0 }}>การประเมินผลการเข้าร่วมกิจกรรมของนักเรียน</h4>
            <div style={{ fontSize: '0.95rem' }}>ชุมนุม <b>{current.name}</b> · ภาคเรียนที่ {term} ปีการศึกษา {year}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px' }}>
            <thead>
              <tr style={{ background: '#F1F5F9' }}>
                <th rowSpan={2} style={{ ...th, width: '4%' }}>ลำดับ</th>
                <th rowSpan={2} style={{ ...th, width: '28%', textAlign: 'left', paddingLeft: 6 }}>ชื่อ-สกุล</th>
                <th rowSpan={2} style={{ ...th, width: '6%' }}>ชั้น</th>
                <th colSpan={4} style={th}>การมีส่วนร่วมในกิจกรรม</th>
                <th colSpan={4} style={th}>การทำกิจกรรมได้ตามวัตถุประสงค์</th>
                <th rowSpan={2} style={{ ...th, width: '10%', background: '#FFEDD5' }}>ผลการประเมิน<br/>(ผ/มผ)</th>
              </tr>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={th}>ดีเยี่ยม</th><th style={th}>ดี</th><th style={th}>ผ่าน</th><th style={th}>ไม่ผ่านเกณฑ์</th>
                <th style={th}>ดีเยี่ยม</th><th style={th}>ดี</th><th style={th}>ผ่าน</th><th style={th}>ไม่ผ่านเกณฑ์</th>
              </tr>
            </thead>
            <tbody>
              {current.members.map((m, i) => {
                const n = presentCount(m.studentId);
                const passRate = dates.length ? n / dates.length : 0;
                const pass = passRate >= 0.8 ? 'ผ' : 'มผ';
                return (
                  <tr key={m.studentId}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, textAlign: 'left', paddingLeft: 6 }}>{m.name}</td>
                    <td style={td}>{m.classLabel.split('/')[0]}</td>
                    <td style={td}></td><td style={td}></td><td style={td}></td><td style={td}></td>
                    <td style={td}></td><td style={td}></td><td style={td}></td><td style={td}></td>
                    <td style={{ ...td, fontWeight: 900, color: pass === 'ผ' ? '#10B981' : '#EF4444', background: '#FFFBEB' }}>{pass}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, textAlign: 'center', fontSize: '11px' }}>
            <div><div style={{ marginTop: 30, paddingTop: 4 }}>
              ลงชื่อ ........................................ ครูประจำชุมนุม
            </div></div>
            <div><div style={{ marginTop: 30, paddingTop: 4 }}>
              ลงชื่อ ........................................ ผู้อำนวยการสถานศึกษา
            </div></div>
          </div>
        </div>
      </div>

      <style>{`@media print {
        @page { size: A4 portrait; margin: 10mm; }
        body { background: white !important; }
        .no-print { display: none !important; }
        .print-area > div { box-shadow: none !important; page-break-after: always; }
      }`}</style>
    </div>
  );
}

const page: React.CSSProperties = { background: 'white', padding: '15mm', minHeight: '270mm', marginBottom: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: '0.85rem', fontWeight: 700 };
const btnPrint: React.CSSProperties = { background: 'white', color: '#1E40AF', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const th: React.CSSProperties = { border: '1px solid #94A3B8', padding: '5px 4px', fontSize: '10px', textAlign: 'center', fontWeight: 800 };
const td: React.CSSProperties = { border: '1px solid #CBD5E1', padding: '4px 3px', textAlign: 'center', fontSize: '10px' };
