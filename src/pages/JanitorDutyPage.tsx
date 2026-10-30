// ตารางเวรนักการภารโรง + รายงานการปฏิบัติงานประจำเดือน
// Roster lives in config/janitor_roster; daily work records come from janitor_tasks
// (written by /janitor-tasks). Both printouts use the shared official layout.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CalendarClock, Plus, Printer, Save, Trash2, Wrench } from 'lucide-react';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import { useTeacherAuth } from '../utils/teacherAuth';
import { useSchoolDays } from '../utils/useSchoolDays';
import { resolveSchoolDay } from '../data/schoolCalendar';
import {
  DUTY_SHIFTS, EMPTY_ROSTER, WEEKDAY_TH, dutiesForDate,
  type DutyShift, type DutySlot, type JanitorRoster,
} from '../data/janitor';
import type { JanitorDailyRecord } from './JanitorTaskPage';
import {
  OfficialDocument, OfficialHeader, SignatureBlock, DIRECTOR_SIGNER, THAI_MONTHS,
  officialTh, officialTd, officialTdLeft, SHADE,
} from '../components/print/Official';

type Tab = 'roster' | 'month' | 'report';
const WEEK_ORDER = ['1', '2', '3', '4', '5', '6', '0']; // จันทร์ .. อาทิตย์

export default function JanitorDutyPage() {
  const auth = useTeacherAuth();
  if (!auth.authed) {
    return <TeacherLoginGate title="🗓️ ตารางเวรนักการภารโรง" subtitle="จัดตารางเวร และพิมพ์รายงานการปฏิบัติงานประจำเดือน" />;
  }
  return <JanitorDuty userName={auth.name} />;
}

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function datesOfMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

// Checklist presets start with an emoji; printed documents use the plain text
const plain = (s: string) => s.replace(/^[^฀-๿A-Za-z0-9]+/, '').trim();

function slotText(s: DutySlot) {
  return `${s.shift}: ${s.staff}${s.area ? ` (${s.area})` : ''}`;
}

function JanitorDuty({ userName }: { userName: string }) {
  const [tab, setTab] = useState<Tab>('roster');
  const [month, setMonth] = useState(thisMonth());
  const [staffList, setStaffList] = useState<string[]>([]);
  const [roster, setRoster] = useState<JanitorRoster>(EMPTY_ROSTER);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<JanitorDailyRecord[]>([]);
  const [reportStaff, setReportStaff] = useState('');
  const [overrideDate, setOverrideDate] = useState('');
  const { holidays, schoolDays } = useSchoolDays();

  // สายสนับสนุนจากทะเบียนบุคลากร (personnel.category === 'support')
  useEffect(() => {
    return onSnapshot(query(collection(db, 'personnel'), orderBy('order', 'asc')), snap => {
      const names: string[] = [];
      snap.forEach(d => {
        const p = d.data() as { category?: string; name?: string };
        if (p.category === 'support' && p.name) names.push(p.name);
      });
      setStaffList(names);
      setReportStaff(prev => prev || names[0] || '');
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'janitor_roster'), snap => {
      if (dirty) return; // keep unsaved edits on screen
      const data = snap.exists() ? (snap.data() as Partial<JanitorRoster>) : {};
      setRoster({ weekly: data.weekly || {}, overrides: data.overrides || {}, updatedAt: data.updatedAt, updatedBy: data.updatedBy });
    });
  }, [dirty]);

  useEffect(() => {
    return onSnapshot(collection(db, 'janitor_tasks'), snap => {
      const arr: JanitorDailyRecord[] = [];
      snap.forEach(d => arr.push({ ...(d.data() as JanitorDailyRecord), id: d.id }));
      setRecords(arr);
    });
  }, []);

  const edit = (next: JanitorRoster) => { setRoster(next); setDirty(true); };

  const saveRoster = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'janitor_roster'), {
        weekly: roster.weekly, overrides: roster.overrides, updatedAt: Date.now(), updatedBy: userName,
      });
      setDirty(false);
    } catch (e: any) {
      alert('บันทึกตารางเวรไม่สำเร็จ: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const addSlot = (key: string, kind: 'weekly' | 'overrides', slot: DutySlot) => {
    const list = [...(roster[kind][key] || []), slot];
    edit({ ...roster, [kind]: { ...roster[kind], [key]: list } });
  };
  const removeSlot = (key: string, kind: 'weekly' | 'overrides', idx: number) => {
    const list = (roster[kind][key] || []).filter((_, i) => i !== idx);
    const next = { ...roster[kind] };
    if (kind === 'overrides' || list.length) next[key] = list; else delete next[key];
    edit({ ...roster, [kind]: next });
  };
  const clearOverride = (date: string) => {
    const next = { ...roster.overrides };
    delete next[date];
    edit({ ...roster, overrides: next });
  };

  const dates = useMemo(() => datesOfMonth(month), [month]);
  const [yy, mm] = month.split('-').map(Number);
  const monthLabel = `${THAI_MONTHS[mm - 1]} พ.ศ. ${yy + 543}`;

  return (
    <SmartSchoolLayout pageTitle="ตารางเวร & รายงานนักการภารโรง">
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        {([['roster', 'จัดตารางเวร'], ['month', 'ตารางเวรประจำเดือน'], ['report', 'รายงานการปฏิบัติงานประจำเดือน']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={tabBtn(tab === k)}>{label}</button>
        ))}
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={input} />
        {tab !== 'roster' && (
          <button onClick={() => window.print()} style={primaryBtn}><Printer size={16} /> พิมพ์</button>
        )}
        <Link to="/janitor-tasks" style={{ ...tabBtn(false), textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Wrench size={15} /> บันทึกงานเช้า-บ่าย
        </Link>
      </div>

      {tab === 'roster' && (
        <div className="no-print" style={{ display: 'grid', gap: 14 }}>
          {staffList.length === 0 && (
            <div style={notice}>ยังไม่มีบุคลากรสายสนับสนุนในทะเบียนบุคลากร (หมวด support) — เพิ่มได้ที่หน้าจัดการระบบส่วนกลาง</div>
          )}
          <div style={card}>
            <h3 style={h3}><CalendarClock size={18} /> เวรประจำสัปดาห์ (ใช้ซ้ำทุกสัปดาห์)</h3>
            {WEEK_ORDER.map(wd => (
              <SlotRow key={wd} title={`วัน${WEEKDAY_TH[Number(wd)]}`} slots={roster.weekly[wd] || []} staffList={staffList}
                onAdd={s => addSlot(wd, 'weekly', s)} onRemove={i => removeSlot(wd, 'weekly', i)} />
            ))}
          </div>

          <div style={card}>
            <h3 style={h3}>เปลี่ยนเวรเฉพาะวัน (แทนตารางประจำสัปดาห์ของวันนั้น)</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <input type="date" value={overrideDate} onChange={e => setOverrideDate(e.target.value)} style={input} />
              <button disabled={!overrideDate || !!roster.overrides[overrideDate]} style={secondaryBtn}
                onClick={() => edit({ ...roster, overrides: { ...roster.overrides, [overrideDate]: [...dutiesForDate({ ...roster, overrides: {} }, overrideDate)] } })}>
                <Plus size={15} /> เริ่มจากตารางประจำสัปดาห์
              </button>
            </div>
            {Object.keys(roster.overrides).sort().map(d => (
              <div key={d} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <SlotRow title={d} slots={roster.overrides[d]} staffList={staffList}
                    onAdd={s => addSlot(d, 'overrides', s)} onRemove={i => removeSlot(d, 'overrides', i)} />
                </div>
                <button onClick={() => clearOverride(d)} style={dangerBtn} title="กลับไปใช้ตารางประจำสัปดาห์">ยกเลิกการเปลี่ยน</button>
              </div>
            ))}
            {Object.keys(roster.overrides).length === 0 && <div style={{ color: '#64748B' }}>ยังไม่มีการเปลี่ยนเวรเฉพาะวัน</div>}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={saveRoster} disabled={!dirty || saving} style={primaryBtn}><Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกตารางเวร'}</button>
            {dirty && <span style={{ color: '#B45309', fontWeight: 700 }}>มีการแก้ไขที่ยังไม่บันทึก</span>}
            {!dirty && roster.updatedAt && (
              <span style={{ color: '#64748B' }}>บันทึกล่าสุด {new Date(roster.updatedAt).toLocaleString('th-TH')} โดย {roster.updatedBy || '-'}</span>
            )}
          </div>
        </div>
      )}

      {tab === 'month' && (
        <OfficialDocument style={paper}>
          <OfficialHeader title="ตารางเวรนักการภารโรง" lines={[`ประจำเดือน${monthLabel}`]} />
          <table style={{ fontSize: '14pt' }}>
            <thead>
              <tr>
                <th style={{ ...officialTh, width: '12%' }}>วันที่</th>
                <th style={{ ...officialTh, width: '14%' }}>วัน</th>
                <th style={officialTh}>ผู้ปฏิบัติเวร / พื้นที่รับผิดชอบ</th>
                <th style={{ ...officialTh, width: '18%' }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(d => {
                const day = resolveSchoolDay(d, schoolDays, holidays);
                const slots = dutiesForDate(roster, d);
                const [y, m, dd] = d.split('-').map(Number);
                return (
                  <tr key={d} className={day.open ? undefined : 'shade'} style={{ background: day.open ? undefined : SHADE }}>
                    <td style={officialTd}>{dd}</td>
                    <td style={officialTd}>{WEEKDAY_TH[new Date(y, m - 1, dd).getDay()]}</td>
                    <td style={officialTdLeft}>{slots.length ? slots.map(slotText).join(' / ') : '-'}</td>
                    <td style={officialTdLeft}>{day.open ? '' : day.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <SignatureBlock signers={[{ role: 'ผู้จัดเวร', name: roster.updatedBy }, DIRECTOR_SIGNER]} />
        </OfficialDocument>
      )}

      {tab === 'report' && (
        <>
          <div className="no-print" style={{ marginBottom: 10 }}>
            <select value={reportStaff} onChange={e => setReportStaff(e.target.value)} style={input}>
              {staffList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <MonthlyReport staff={reportStaff} dates={dates} monthLabel={monthLabel} roster={roster}
            records={records} holidays={holidays} schoolDays={schoolDays} />
        </>
      )}

      <style>{`@media print { @page { size: A4 portrait; margin: 15mm 15mm 15mm 20mm; } .print-area { padding: 0 !important; } }`}</style>
    </SmartSchoolLayout>
  );
}

function MonthlyReport({ staff, dates, monthLabel, roster, records, holidays, schoolDays }: {
  staff: string;
  dates: string[];
  monthLabel: string;
  roster: JanitorRoster;
  records: JanitorDailyRecord[];
  holidays: Record<string, string>;
  schoolDays: Parameters<typeof resolveSchoolDay>[1];
}) {
  const byDate = useMemo(() => {
    const map: Record<string, JanitorDailyRecord> = {};
    records.filter(r => r.staffName === staff).forEach(r => { map[r.date] = r; });
    return map;
  }, [records, staff]);

  let workDays = 0, recorded = 0, complete = 0;
  const rows = dates.map(d => {
    const day = resolveSchoolDay(d, schoolDays, holidays);
    const duty = dutiesForDate(roster, d).filter(s => s.staff === staff);
    const rec = byDate[d];
    if (day.open || duty.length) workDays++;
    if (rec) recorded++;
    if (rec?.complianceStatus === 'ตามคำสั่งครบถ้วน') complete++;
    return { d, day, duty, rec };
  });

  return (
    <OfficialDocument style={paper}>
      <OfficialHeader title="แบบรายงานการปฏิบัติงานนักการภารโรง" lines={[`ชื่อผู้ปฏิบัติงาน ${staff || '-'}   ประจำเดือน${monthLabel}`]} />
      <table style={{ fontSize: '13pt' }}>
        <thead>
          <tr>
            <th style={{ ...officialTh, width: '7%' }}>วันที่</th>
            <th style={{ ...officialTh, width: '17%' }}>เวรตามตาราง</th>
            <th style={officialTh}>งานที่ปฏิบัติช่วงเช้า</th>
            <th style={officialTh}>งานที่ปฏิบัติช่วงบ่าย</th>
            <th style={{ ...officialTh, width: '15%' }}>ผลการตรวจ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ d, day, duty, rec }) => {
            const off = !day.open && !duty.length;
            return (
              <tr key={d} className={off ? 'shade' : undefined} style={{ background: off ? SHADE : undefined }}>
                <td style={officialTd}>{Number(d.slice(8))}</td>
                <td style={officialTdLeft}>{duty.length ? duty.map(s => s.shift + (s.area ? ` (${s.area})` : '')).join(', ') : (off ? day.label : '-')}</td>
                <td style={officialTdLeft}>{rec ? [...(rec.morningChecklist || []).map(plain), rec.morningDetail].filter(Boolean).join(' / ') || '-' : ''}</td>
                <td style={officialTdLeft}>{rec ? [...(rec.afternoonChecklist || []).map(plain), rec.afternoonDetail].filter(Boolean).join(' / ') || '-' : ''}</td>
                <td style={officialTd}>{rec ? rec.complianceStatus : (off ? '' : 'ไม่มีบันทึก')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: '14pt' }}>
        <b>สรุป</b> วันปฏิบัติงาน {workDays} วัน &nbsp; มีบันทึก {recorded} วัน &nbsp; ปฏิบัติตามคำสั่งครบถ้วน {complete} วัน &nbsp; ช่องแรเงา = วันหยุดที่ไม่มีเวร
      </div>
      <SignatureBlock signers={[
        { role: 'ผู้ปฏิบัติงาน', name: staff, position: 'นักการภารโรง' },
        { role: 'ผู้ตรวจสอบ' },
        DIRECTOR_SIGNER,
      ]} />
    </OfficialDocument>
  );
}

function SlotRow({ title, slots, staffList, onAdd, onRemove }: {
  title: string;
  slots: DutySlot[];
  staffList: string[];
  onAdd: (s: DutySlot) => void;
  onRemove: (i: number) => void;
}) {
  const [shift, setShift] = useState<DutyShift>('เช้า');
  const [staff, setStaff] = useState('');
  const [area, setArea] = useState('');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, padding: '8px 0', borderBottom: '1px solid #E2E8F0' }}>
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {slots.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{slotText(s)}</span>
            <button onClick={() => onRemove(i)} style={iconBtn} title="ลบเวรนี้ออกจากตาราง"><Trash2 size={14} /></button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select value={shift} onChange={e => setShift(e.target.value as DutyShift)} style={input}>
            {DUTY_SHIFTS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={staff} onChange={e => setStaff(e.target.value)} style={input}>
            <option value="">เลือกผู้ปฏิบัติ</option>
            {staffList.map(s => <option key={s}>{s}</option>)}
          </select>
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="พื้นที่/งานที่รับผิดชอบ" style={{ ...input, minWidth: 200 }} />
          <button disabled={!staff} onClick={() => { onAdd({ shift, staff, area: area.trim() }); setArea(''); }} style={secondaryBtn}>
            <Plus size={14} /> เพิ่ม
          </button>
        </div>
      </div>
    </div>
  );
}

const paper: React.CSSProperties = { background: 'white', maxWidth: '210mm', margin: '0 auto', padding: '15mm 15mm 15mm 20mm', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const card: React.CSSProperties = { background: 'white', borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const h3: React.CSSProperties = { margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '1.05rem' };
const notice: React.CSSProperties = { background: '#FEF3C7', color: '#92400E', padding: '10px 14px', borderRadius: 10, fontWeight: 700 };
const input: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.9rem' };
const primaryBtn: React.CSSProperties = { background: '#0F766E', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const secondaryBtn: React.CSSProperties = { background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', borderRadius: 8, padding: '7px 12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const dangerBtn: React.CSSProperties = { ...secondaryBtn, color: '#B91C1C', marginTop: 8 };
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', padding: 2 };
const tabBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#0F766E' : 'white', color: active ? 'white' : '#334155', border: '1px solid #CBD5E1',
  borderRadius: 999, padding: '7px 14px', fontWeight: 800, cursor: 'pointer', fontSize: '0.88rem',
});
