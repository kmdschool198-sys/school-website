import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Check, X as XIcon, Clock, Save, Download, ChevronLeft, LogOut, Users, ClipboardCheck, Printer } from 'lucide-react';
import type { Club, ClubAttendanceDoc, AttStatus, ClubEvaluation, EvalLevel } from '../data/clubs';
import { EVAL_LABELS } from '../data/clubs';
import { useTeacherAuth } from '../utils/teacherAuth';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { THAI_MONTHS_FULL, daysInMonth, downloadCsvReport, makeSectionedReportRows, monthLabel, yearLabel } from '../utils/csvReport';

const BRAND = '#FF6A01';
const STATUS_COLORS: Record<AttStatus, string> = { present: BRAND, absent: '#EF4444', leave: '#F59E0B' };
const STATUS_LABELS: Record<AttStatus, string> = { present: 'มา', absent: 'ขาด', leave: 'ลา' };
type CsvPeriod = 'month' | 'year';

export default function ClubAttendancePage() {
  const auth = useTeacherAuth();
  if (!auth.authed) return <TeacherLoginGate title="🎯 เช็คชื่อชุมนุม / กิจกรรม / ลูกเสือ" />;
  return <App userName={auth.name} onLogout={auth.logout} />;
}

function App({ userName, onLogout }: { userName: string; onLogout: () => void }) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [csvPeriod, setCsvPeriod] = useState<CsvPeriod>('month');
  const [records, setRecords] = useState<ClubAttendanceDoc['records']>({});
  const [clubHistory, setClubHistory] = useState<ClubAttendanceDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [tab, setTab] = useState<'check' | 'eval'>('check');
  const [evalRecords, setEvalRecords] = useState<ClubEvaluation['records']>({});

  // Load evaluation for current club
  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, 'club_evaluations', clubId), snap => {
      if (snap.exists()) setEvalRecords((snap.data() as ClubEvaluation).records || {});
      else setEvalRecords({});
    });
  }, [clubId]);

  const updateEval = async (sid: string, field: 'participation' | 'objectives' | 'result', value: any) => {
    const next = { ...evalRecords, [sid]: { ...(evalRecords[sid] || {}), [field]: value } };
    setEvalRecords(next);
    try {
      const clean: ClubEvaluation['records'] = {};
      for (const [k, v] of Object.entries(next)) {
        const item: any = {};
        if (v.participation) item.participation = v.participation;
        if (v.objectives) item.objectives = v.objectives;
        if (v.result) item.result = v.result;
        if (v.note) item.note = v.note;
        if (Object.keys(item).length) clean[k] = item;
      }
      await setDoc(doc(db, 'club_evaluations', clubId), {
        clubId, records: clean, updatedAt: Date.now(),
      });
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  useEffect(() => {
    return onSnapshot(collection(db, 'clubs'), snap => {
      const arr: Club[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setClubs(arr);
    });
  }, []);

  useEffect(() => {
    if (!clubId && clubs.length) setClubId(clubs[0].id);
  }, [clubs]);

  useEffect(() => {
    if (!clubId) return;
    return onSnapshot(doc(db, 'club_attendance', `${clubId}_${date}`), snap => {
      if (snap.exists()) setRecords((snap.data() as ClubAttendanceDoc).records || {});
      else setRecords({});
    });
  }, [clubId, date]);

  useEffect(() => {
    if (!clubId) return;
    const q = query(collection(db, 'club_attendance'), where('clubId', '==', clubId));
    return onSnapshot(q, snap => {
      const docs: ClubAttendanceDoc[] = [];
      snap.forEach(d => docs.push(d.data() as ClubAttendanceDoc));
      setClubHistory(docs);
    });
  }, [clubId]);

  const currentClub = clubs.find(c => c.id === clubId);
  const members = currentClub?.members || [];

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, untracked: 0 };
    members.forEach(m => {
      const st = records[m.studentId]?.status || 'present';
      c[st]++;
    });
    return c;
  }, [records, members]);

  const validation = useMemo(() => {
    if (!currentClub || !date) return { isValid: true, reason: '' };
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, ...
    if (currentClub.type === 'ลูกเสือ-เนตรนารี' && dayOfWeek !== 3) {
      return { isValid: false, reason: 'กิจกรรมลูกเสือ-เนตรนารี จะต้องเช็คชื่อเฉพาะวันพุธเท่านั้น' };
    }
    if (currentClub.type === 'ชุมนุม' && dayOfWeek !== 4) {
      return { isValid: false, reason: 'กิจกรรมชุมนุม จะต้องเช็คชื่อเฉพาะวันพฤหัสบดีเท่านั้น' };
    }
    return { isValid: true, reason: '' };
  }, [currentClub, date]);

  const setStatus = (sid: string, status: AttStatus) => {
    setRecords(r => ({ ...r, [sid]: { ...(r[sid] || {}), status } }));
  };
  const setNote = (sid: string, note: string) => {
    setRecords(r => ({ ...r, [sid]: { ...(r[sid] || { status: 'present' }), note } }));
  };
  const markAll = (status: AttStatus) => {
    const r: ClubAttendanceDoc['records'] = {};
    members.forEach(m => {
      const note = records[m.studentId]?.note;
      r[m.studentId] = note ? { status, note } : { status };
    });
    setRecords(r);
  };
  const clearAll = () => setRecords({});

  const cleanRecords = (recs: ClubAttendanceDoc['records']) => {
    const out: ClubAttendanceDoc['records'] = {};
    members.forEach(m => {
      const v = recs[m.studentId] || { status: 'present' };
      const item: any = { status: v.status || 'present' };
      if (v.note) item.note = v.note;
      out[m.studentId] = item;
    });
    return out;
  };

  const save = async () => {
    if (!clubId) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'club_attendance', `${clubId}_${date}`), {
        clubId, date, records: cleanRecords(records), updatedAt: Date.now(),
      });
      setSavedAt(new Date());
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
    setSaving(false);
  };

  const exportCsv = () => {
    if (!currentClub) return;
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);
    const classLabels = Array.from(new Set(members.map(m => m.classLabel || 'ไม่ระบุชั้น'))).sort((a, b) => a.localeCompare(b, 'th'));
    const sections = classLabels.map(classLabel => {
      const classMembers = members.filter(m => (m.classLabel || 'ไม่ระบุชั้น') === classLabel);
      const rows = csvPeriod === 'month'
        ? classMembers.map((m, i) => {
        const row = [String(i + 1), m.code, m.name];
        let present = 0;
        let absent = 0;
        let leave = 0;
        daysInMonth(month).forEach(day => {
          const dayText = `${month}-${String(day).padStart(2, '0')}`;
          const rec = clubHistory.find(docItem => docItem.date === dayText)?.records?.[m.studentId];
          if (rec?.status === 'present') present++;
          if (rec?.status === 'absent') absent++;
          if (rec?.status === 'leave') leave++;
          row.push(rec ? STATUS_LABELS[rec.status] : '-');
        });
        row.push(String(present), String(absent), String(leave));
        return row;
      })
        : classMembers.map((m, i) => {
        const row = [String(i + 1), m.code, m.name];
        let present = 0;
        let absent = 0;
        let leave = 0;
        Array.from({ length: 12 }, (_, idx) => idx + 1).forEach(monthNumber => {
          const prefix = `${year}-${String(monthNumber).padStart(2, '0')}`;
          const docs = clubHistory.filter(docItem => docItem.date.startsWith(prefix));
          let monthPresent = 0;
          let monthTotal = 0;
          docs.forEach(docItem => {
            const rec = docItem.records?.[m.studentId];
            if (!rec) return;
            monthTotal++;
            if (rec.status === 'present') { monthPresent++; present++; }
            else if (rec.status === 'absent') absent++;
            else if (rec.status === 'leave') leave++;
          });
          row.push(monthTotal ? `${monthPresent}/${monthTotal}` : '-');
        });
        row.push(String(present), String(absent), String(leave));
        return row;
      });

      return {
        title: `ชั้น ${classLabel}`,
        headers: csvPeriod === 'month'
          ? ['ที่', 'รหัส', 'ชื่อ-สกุล', ...daysInMonth(month).map(String), 'รวมมา', 'รวมขาด', 'รวมลา']
          : ['ที่', 'รหัส', 'ชื่อ-สกุล', ...THAI_MONTHS_FULL.map(m => `${m} (มา/รวม)`), 'รวมมา', 'รวมขาด', 'รวมลา'],
        rows: rows.length ? rows : [['-', '-', 'ยังไม่มีสมาชิก']],
      };
    });
    const reportRows = makeSectionedReportRows({
      title: 'รายงานเช็คชื่อชุมนุม/กิจกรรม/ลูกเสือ โรงเรียนบ้านคลองมดแดง',
      subtitle: csvPeriod === 'month' ? `รายเดือน ${monthLabel(month)}` : `รายปี ${yearLabel(year)}`,
      meta: [['กิจกรรม', `${currentClub.type} · ${currentClub.name}`], ['ครูที่ปรึกษา', currentClub.advisor], ['ผู้ส่งออก', userName], ['วันที่สร้างไฟล์', new Date().toLocaleString('th-TH')]],
      sections,
      footerRows: [['หมายเหตุ', csvPeriod === 'year' ? 'ช่องรายปีแสดงจำนวนมา/จำนวนวันที่มีข้อมูล' : 'มา/ขาด/ลา ตามข้อมูลที่บันทึก']],
    });
    downloadCsvReport(`เช็คชื่อชุมนุม_${currentClub.name}_${csvPeriod === 'month' ? `รายเดือน_${month}` : `รายปี_${year}`}`, reportRows);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FFF7ED' }}>
      <header style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', padding: '1.2rem 1.25rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" style={lnk}><ChevronLeft size={16} />หน้าหลัก</Link>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>🎯 เช็คชื่อชุมนุม / กิจกรรม / ลูกเสือ</div>
            <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>โรงเรียนบ้านคลองมดแดง · {userName}</div>
          </div>
          <button onClick={onLogout} style={btnLogout}><LogOut size={12} />ออกจากระบบ</button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '1.25rem' }}>
        {/* Club + date pickers */}
        <div style={{ background: 'white', borderRadius: 12, padding: '1rem', marginBottom: 14,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10 }}>
          <div>
            <label style={lbl}>เลือกชุมนุม / กิจกรรม</label>
            {clubs.length === 0 ? (
              <div style={{ padding: '8px 12px', background: '#FEF3C7', borderRadius: 8, color: '#92400E', fontSize: '0.85rem' }}>
                ⚠️ ยังไม่มีชุมนุม — สร้างที่หน้า Admin → "ชุมนุม-กิจกรรม" ก่อน
              </div>
            ) : (
              <select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.type} · {c.name} ({c.members.length} คน)</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={lbl}>วันที่เช็คชื่อ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
            <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{fmtThai(date)}</div>
          </div>
        </div>

        {!currentClub ? null : (
          <>
            <div style={{ background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: '0.78rem', color: '#7C2D12', fontWeight: 700, letterSpacing: 1 }}>
                {currentClub.type}
              </div>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#0F172A' }}>{currentClub.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
                👨‍🏫 ครูที่ปรึกษา: <b>{currentClub.advisor}</b> · <Users size={12} style={{ verticalAlign: 'middle' }} /> {members.length} คน
              </div>
              {currentClub.description && <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 4 }}>{currentClub.description}</div>}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <button onClick={() => setTab('check')} style={tabBtn(tab === 'check')}>
                <Check size={14} /> เช็คชื่อรายวัน
              </button>
              <button onClick={() => setTab('eval')} style={tabBtn(tab === 'eval')}>
                <ClipboardCheck size={14} /> ประเมินผลสมาชิก
              </button>
              <Link to="/print-club" style={{ ...tabBtn(false), marginLeft: 'auto', textDecoration: 'none' }}>
                <Printer size={14} /> พิมพ์ฟอร์ม
              </Link>
            </div>

            {tab === 'eval' && (
              <EvalTable members={members} evalRecords={evalRecords} updateEval={updateEval} />
            )}

            {tab === 'check' && <>

            {/* Validation Warning */}
            {!validation.isValid && (
              <div style={{
                background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B',
                padding: '12px 14px', borderRadius: 12, marginBottom: 14, fontWeight: 700,
                fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <span>⚠️ {validation.reason} (วันอื่นไม่เช็คชื่อ)</span>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={() => markAll('present')} disabled={!validation.isValid} style={{ ...quickBtn, background: BRAND, opacity: !validation.isValid ? 0.5 : 1, cursor: !validation.isValid ? 'not-allowed' : 'pointer' }}>✓ มาทั้งหมด</button>
              <button onClick={clearAll} disabled={!validation.isValid} style={{ ...quickBtn, background: '#EF4444', opacity: !validation.isValid ? 0.5 : 1, cursor: !validation.isValid ? 'not-allowed' : 'pointer' }}>↺ ล้างทั้งหมด</button>
              <button onClick={save} disabled={saving || !validation.isValid} style={{ ...quickBtn, background: '#0F172A', marginLeft: 'auto', opacity: (saving || !validation.isValid) ? 0.5 : 1, cursor: (saving || !validation.isValid) ? 'not-allowed' : 'pointer' }}>
                <Save size={14} style={{ marginRight: 4 }} />{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}
              </button>
              <select value={csvPeriod} onChange={e => setCsvPeriod(e.target.value as CsvPeriod)} style={{ ...inp, width: 'auto', minWidth: 190 }}>
                <option value="month">CSV รายเดือน ({monthLabel(date.slice(0, 7))})</option>
                <option value="year">CSV รายปี ({yearLabel(date.slice(0, 4))})</option>
              </select>
              <button onClick={exportCsv} style={{ ...quickBtn, background: '#10B981' }}>
                <Download size={14} style={{ marginRight: 4 }} />โหลด CSV
              </button>
              {savedAt && <span style={{ fontSize: '0.72rem', color: BRAND, fontWeight: 700 }}>✓ {savedAt.toLocaleTimeString('th-TH')}</span>}
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              <Stat label="มา" value={counts.present} color={STATUS_COLORS.present} />
              <Stat label="ขาด" value={counts.absent} color={STATUS_COLORS.absent} />
              <Stat label="ลา" value={counts.leave} color={STATUS_COLORS.leave} />
              <Stat label="ยังไม่เช็ค" value={counts.untracked} color="#94A3B8" />
            </div>

            {/* Member list */}
            {members.length === 0 ? (
              <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
                ชุมนุมนี้ยังไม่มีสมาชิก — เพิ่มสมาชิกที่หน้า Admin
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map((m, i) => {
                  const r = records[m.studentId];
                  const st = r?.status || 'present';
                  return (
                    <div key={m.studentId} style={{
                      background: 'white', borderRadius: 12, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      borderLeft: `4px solid ${STATUS_COLORS[st]}`,
                    }}>
                      <span style={{ fontWeight: 800, color: '#94A3B8', minWidth: 24 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{m.code} · {m.classLabel}</div>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{m.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(['present', 'absent', 'leave'] as AttStatus[]).map(status => (
                          <button key={status} onClick={() => setStatus(m.studentId, status)}
                            disabled={!validation.isValid}
                            style={{
                              padding: '8px 12px', borderRadius: 10, border: 'none',
                              cursor: !validation.isValid ? 'not-allowed' : 'pointer',
                              fontWeight: 800, fontSize: '0.78rem',
                              background: st === status ? STATUS_COLORS[status] : '#F1F5F9',
                              color: st === status ? 'white' : '#64748B',
                              opacity: !validation.isValid ? 0.5 : 1,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                            {status === 'present' ? <Check size={12} /> : status === 'absent' ? <XIcon size={12} /> : <Clock size={12} />}
                            {STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                      <input placeholder="หมายเหตุ..." value={r?.note || ''}
                        disabled={!validation.isValid}
                        onChange={e => setNote(m.studentId, e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem', maxWidth: 180 }} />
                    </div>
                  );
                })}
              </div>
            )}
            </>}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Evaluation table component ───
function EvalTable({ members, evalRecords, updateEval }: {
  members: any[];
  evalRecords: ClubEvaluation['records'];
  updateEval: (sid: string, field: any, value: any) => void;
}) {
  if (members.length === 0) return (
    <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
      ยังไม่มีสมาชิก
    </div>
  );

  const levels: EvalLevel[] = ['excellent', 'good', 'pass', 'fail'];
  const colorOf = (l?: EvalLevel) =>
    l === 'excellent' ? '#10B981' : l === 'good' ? '#3B82F6' : l === 'pass' ? '#F59E0B' : l === 'fail' ? '#EF4444' : '#94A3B8';

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1rem' }}>
      <div style={{ marginBottom: 10, padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, fontSize: '0.82rem', color: '#7C2D12' }}>
        💡 ติ๊กระดับ <b>ดีเยี่ยม / ดี / ผ่าน / ไม่ผ่านเกณฑ์</b> ในแต่ละช่อง · บันทึกอัตโนมัติ · ใช้ตอนพิมพ์ฟอร์มชุมนุม
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
              <th rowSpan={2} style={evTh}>ที่</th>
              <th rowSpan={2} style={{ ...evTh, textAlign: 'left', minWidth: 200 }}>ชื่อ-สกุล</th>
              <th rowSpan={2} style={evTh}>ชั้น</th>
              <th colSpan={4} style={evTh}>การมีส่วนร่วม</th>
              <th colSpan={4} style={evTh}>ทำกิจกรรมได้ตามวัตถุประสงค์</th>
              <th rowSpan={2} style={{ ...evTh, background: '#7C2D12' }}>ผล (ผ/มผ)</th>
            </tr>
            <tr style={{ background: 'linear-gradient(135deg,#1E3A8A,#3B82F6)', color: 'white' }}>
              {levels.map(l => <th key={`p${l}`} style={{ ...evTh, fontSize: '0.7rem' }}>{EVAL_LABELS[l]}</th>)}
              {levels.map(l => <th key={`o${l}`} style={{ ...evTh, fontSize: '0.7rem' }}>{EVAL_LABELS[l]}</th>)}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => {
              const r = evalRecords[m.studentId] || {};
              return (
                <tr key={m.studentId} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                  <td style={evTd}>{i + 1}</td>
                  <td style={{ ...evTd, textAlign: 'left', fontWeight: 700 }}>{m.name}</td>
                  <td style={evTd}><small>{m.classLabel}</small></td>
                  {levels.map(l => (
                    <td key={`p${l}`} style={evTd}>
                      <input type="radio" name={`p_${m.studentId}`} checked={r.participation === l}
                        onChange={() => updateEval(m.studentId, 'participation', l)}
                        style={{ cursor: 'pointer', accentColor: colorOf(l) }} />
                    </td>
                  ))}
                  {levels.map(l => (
                    <td key={`o${l}`} style={evTd}>
                      <input type="radio" name={`o_${m.studentId}`} checked={r.objectives === l}
                        onChange={() => updateEval(m.studentId, 'objectives', l)}
                        style={{ cursor: 'pointer', accentColor: colorOf(l) }} />
                    </td>
                  ))}
                  <td style={{ ...evTd, background: '#FFF7ED' }}>
                    <select value={r.result || ''} onChange={e => updateEval(m.studentId, 'result', e.target.value || undefined)}
                      style={{ padding: 4, borderRadius: 4, border: '1px solid #E2E8F0', fontWeight: 800, color: r.result === 'ผ' ? '#10B981' : r.result === 'มผ' ? '#EF4444' : '#94A3B8' }}>
                      <option value="">—</option>
                      <option value="ผ">ผ</option>
                      <option value="มผ">มผ</option>
                    </select>
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

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
  fontWeight: 800, fontSize: '0.85rem',
  background: active ? '#FF6A01' : 'white', color: active ? 'white' : '#475569',
  display: 'inline-flex', alignItems: 'center', gap: 6,
  boxShadow: active ? '0 4px 10px rgba(255,106,1,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
});
const evTh: React.CSSProperties = { padding: '8px 6px', fontWeight: 800, fontSize: '0.78rem', textAlign: 'center', whiteSpace: 'nowrap' };
const evTd: React.CSSProperties = { padding: '6px 8px', textAlign: 'center' };

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtThai = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${months[m - 1]} ${y + 543}`; };

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div style={{ background: 'white', padding: 10, borderRadius: 10, textAlign: 'center', borderTop: `3px solid ${color}` }}>
    <div style={{ fontSize: '1.5rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700 }}>{label}</div>
  </div>;
}

const lnk: React.CSSProperties = { color: 'white', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem', opacity: 0.9 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnLogout: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const quickBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.8rem', color: 'white', display: 'inline-flex', alignItems: 'center' };
