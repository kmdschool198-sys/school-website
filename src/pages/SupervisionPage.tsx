import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where,
} from 'firebase/firestore';
import { ClipboardList, ExternalLink, Pencil, Printer, Save, Trash2, X } from 'lucide-react';
import { db } from '../firebase';
import SmartSchoolLayout from '../components/SmartSchoolLayout';
import TeacherLoginGate from '../components/TeacherLoginGate';
import DriveImage from '../components/DriveImage';
import { OfficialDocument, OfficialHeader } from '../components/print/Official';
import { officialTd, officialTdLeft, officialTh } from '../components/print/officialStyles';
import { STAFF_USERS_COLLECTION, canManageStaffUsers, useTeacherAuth } from '../utils/teacherAuth';
import {
  SUPERVISION_ASPECTS, SUPERVISION_COLLECTION, SUPERVISION_LEVELS, SUPERVISION_ROUNDS,
  aspectForRound, cleanPhotoLinks, formatPercent, getAspect, normalizeEmail, scoreSupervision,
  summarizeSupervision, supervisionDocId, supervisionLevel,
  type SupervisionAspectId, type SupervisionRecord, type SupervisionRound, type SupervisionScores,
} from '../data/supervision';

const CURRENT_YEAR = 2569;
const YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const thaiDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '-';
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const levelColor = (percent: number) => supervisionLevel(percent).color;

interface StaffOption { email: string; name: string }

const card: CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20, marginBottom: 18 };
const input: CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 4 };
const btn = (bg: string, color = '#fff'): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none',
  background: bg, color, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
});

export default function SupervisionPage() {
  const auth = useTeacherAuth();
  if (auth.loading) return null;
  if (!auth.authed) {
    return <TeacherLoginGate title="📋 ระบบนิเทศภายใน" subtitle="เข้าสู่ระบบเพื่อดูผลการนิเทศของคุณ" />;
  }
  const isAdmin = canManageStaffUsers(auth.role);
  return (
    <SmartSchoolLayout>
      <style>{`.sup-print{display:none}@media print{.sup-screen{display:none!important}.sup-print{display:block}}`}</style>
      {isAdmin
        ? <AdminView adminName={auth.name} adminEmail={auth.email} />
        : <TeacherView email={auth.email} name={auth.name} />}
    </SmartSchoolLayout>
  );
}

// ─────────────────────────────── shared pieces ───────────────────────────────

function PageTitle({ subtitle, year, setYear }: { subtitle: string; year: number; setYear: (y: number) => void }) {
  return (
    <div className="sup-screen" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={26} color="#7C3AED" /> การนิเทศภายในรายบุคคล
        </h1>
        <div style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>{subtitle}</div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#334155' }}>
        ปีการศึกษา
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...input, width: 'auto' }} aria-label="ปีการศึกษา">
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </div>
  );
}

function LevelBadge({ percent }: { percent: number }) {
  const lv = supervisionLevel(percent);
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: lv.color, background: `${lv.color}14`, border: `1px solid ${lv.color}40` }}>
      {lv.label}
    </span>
  );
}

/** ตาราง "ผลการนิเทศ" ของครู 1 คน: 3 ครั้ง ร้อยละรายด้าน รวม และเฉลี่ย */
function SummaryTable({ records, year, onOpen, selectedRound }: {
  records: SupervisionRecord[];
  year: number;
  onOpen?: (round: SupervisionRound) => void;
  selectedRound?: SupervisionRound | null;
}) {
  const s = summarizeSupervision(records, year);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
        <thead>
          <tr style={{ background: '#F1F5F9' }}>
            <th style={th}>ครั้งที่</th>
            <th style={{ ...th, textAlign: 'left' }}>ด้านที่นิเทศ</th>
            <th style={th}>วันที่นิเทศ</th>
            <th style={th}>คะแนน</th>
            <th style={th}>ร้อยละ</th>
            <th style={th}>ระดับ</th>
          </tr>
        </thead>
        <tbody>
          {s.rounds.map(({ round, aspect, record }) => (
            <tr
              key={round}
              onClick={record && onOpen ? () => onOpen(round) : undefined}
              style={{ cursor: record && onOpen ? 'pointer' : 'default', background: selectedRound === round ? '#F5F3FF' : undefined }}
            >
              <td style={td}>{round}</td>
              <td style={{ ...td, textAlign: 'left' }}>{record ? getAspect(record.aspect)?.title : aspect.title}</td>
              <td style={td}>{record ? thaiDate(record.date) : '-'}</td>
              <td style={td}>{record ? `${record.total}/${record.max}` : '-'}</td>
              <td style={{ ...td, fontWeight: 800, color: record ? levelColor(record.percent) : '#94A3B8' }}>
                {record ? formatPercent(record.percent) : 'ยังไม่นิเทศ'}
              </td>
              <td style={td}>{record ? <LevelBadge percent={record.percent} /> : '-'}</td>
            </tr>
          ))}
          <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
            <td style={td} colSpan={4}>รวม ({s.done}/3 ด้าน)</td>
            <td style={td}>{s.done ? formatPercent(s.sumPercent) : '-'}</td>
            <td style={td} />
          </tr>
          <tr style={{ background: '#F8FAFC', fontWeight: 800 }}>
            <td style={td} colSpan={4}>เฉลี่ยร้อยละ</td>
            <td style={{ ...td, color: s.averagePercent === null ? '#94A3B8' : levelColor(s.averagePercent) }}>
              {s.averagePercent === null ? '-' : formatPercent(s.averagePercent)}
            </td>
            <td style={td}>{s.averagePercent === null ? '-' : <LevelBadge percent={s.averagePercent} />}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const th: CSSProperties = { padding: '8px 10px', border: '1px solid #E2E8F0', fontWeight: 700, color: '#334155', textAlign: 'center', whiteSpace: 'nowrap' };
const td: CSSProperties = { padding: '8px 10px', border: '1px solid #E2E8F0', textAlign: 'center' };

function PhotoLinks({ links }: { links: string[] }) {
  if (!links.length) return <div style={{ color: '#94A3B8' }}>ไม่มีรูปแนบ</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
      {links.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#4338CA', fontSize: 13 }}>
          <DriveImage src={url} alt={`รูปประกอบ ${i + 1}`} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}><ExternalLink size={13} /> รูปที่ {i + 1}</span>
        </a>
      ))}
    </div>
  );
}

/** ผลการนิเทศ 1 ครั้งแบบอ่านอย่างเดียว */
function RecordDetail({ record }: { record: SupervisionRecord }) {
  const aspect = getAspect(record.aspect);
  if (!aspect) return null;
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
          ครั้งที่ {record.round} · {aspect.title}
        </div>
        <div style={{ color: '#64748B' }}>นิเทศเมื่อ {thaiDate(record.date)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat title="คะแนนรวม" value={`${record.total} / ${record.max}`} />
        <Stat title="คิดเป็นร้อยละ" value={formatPercent(record.percent)} color={levelColor(record.percent)} />
        <Stat title="ระดับคุณภาพ" value={record.level} color={levelColor(record.percent)} />
      </div>
      {(record.teaching || record.homeroom) && (
        <div style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>
          {record.teaching && <div>รับผิดชอบงานสอน: {record.teaching}</div>}
          {record.homeroom && <div>งานประจำชั้น: {record.homeroom}</div>}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={th}>ที่</th>
              <th style={{ ...th, textAlign: 'left' }}>รายการนิเทศ</th>
              <th style={th}>คะแนน</th>
              <th style={{ ...th, textAlign: 'left' }}>ระดับการปฏิบัติ</th>
              <th style={{ ...th, textAlign: 'left' }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {aspect.items.map((item, i) => {
              const v = record.scores[String(i)];
              return (
                <tr key={i}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: 'left' }}>{item}</td>
                  <td style={{ ...td, fontWeight: 800, color: v === 0 ? '#B91C1C' : '#047857' }}>{typeof v === 'number' ? `${v}/${aspect.maxPerItem}` : '-'}</td>
                  <td style={{ ...td, textAlign: 'left', color: '#475569' }}>{typeof v === 'number' ? aspect.scaleLabels[v] : '-'}</td>
                  <td style={{ ...td, textAlign: 'left', color: '#475569' }}>{record.itemNotes?.[String(i)] || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Section title="ข้อเสนอแนะของคณะกรรมการ">
        <div style={{ whiteSpace: 'pre-wrap', color: record.suggestion ? '#1E293B' : '#94A3B8' }}>{record.suggestion || '-'}</div>
      </Section>
      {record.otherWork && (
        <Section title="งานอื่น ๆ ที่ได้รับมอบหมาย">
          <div style={{ whiteSpace: 'pre-wrap' }}>{record.otherWork}</div>
        </Section>
      )}
      <Section title={`รูปภาพประกอบ (${record.photoLinks.length})`}>
        <PhotoLinks links={record.photoLinks} />
      </Section>
      {(record.committee?.chair || record.committee?.member || record.committee?.secretary) && (
        <Section title="คณะกรรมการนิเทศ">
          <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.8 }}>
            {record.committee.chair && <div>ประธานกรรมการ: {record.committee.chair}</div>}
            {record.committee.member && <div>กรรมการ: {record.committee.member}</div>}
            {record.committee.secretary && <div>กรรมการและเลขานุการ: {record.committee.secretary}</div>}
          </div>
        </Section>
      )}
    </div>
  );
}

function Stat({ title, value, color = '#0F172A' }: { title: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 800, color: '#334155', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

/** แบบนิเทศ 1 ครั้งสำหรับพิมพ์ ตามรูปแบบเอกสารของโรงเรียน */
function PrintRecord({ record }: { record: SupervisionRecord }) {
  const aspect = getAspect(record.aspect);
  if (!aspect) return null;
  const [y, m, d] = record.date.split('-').map(Number);
  return (
    <OfficialDocument>
      <OfficialHeader
        title="แบบประเมินการนิเทศภายในรายบุคคล"
        lines={[
          `นิเทศครั้งที่ ${record.round} เมื่อวันที่ ${d || '....'} เดือน ${THAI_MONTHS[(m || 1) - 1]} พ.ศ. ${(y || 0) + 543} ปีการศึกษา ${record.year}`,
          `ชื่อผู้รับการนิเทศ ${record.teacherName}${record.teaching ? `  รับผิดชอบงานสอน ${record.teaching}` : ''}`,
          record.homeroom ? `งานประจำชั้น ${record.homeroom}` : '',
        ].filter(Boolean)}
      />
      <div style={{ fontWeight: 700, margin: '6pt 0 4pt' }}>{aspect.id}. {aspect.title}</div>
      <table>
        <thead>
          <tr>
            <th style={officialTh} rowSpan={2}>ที่</th>
            <th style={officialTh} rowSpan={2}>รายการนิเทศ</th>
            <th style={officialTh} colSpan={aspect.maxPerItem + 1}>ระดับการปฏิบัติ</th>
            <th style={officialTh} rowSpan={2}>หมายเหตุ</th>
          </tr>
          <tr>
            {aspect.scaleLabels.map((l, i) => <th key={i} style={{ ...officialTh, fontSize: '13pt', width: '2.4cm' }}>{l} ({i})</th>)}
          </tr>
        </thead>
        <tbody>
          {aspect.items.map((item, i) => (
            <tr key={i}>
              <td style={officialTd}>{i + 1}</td>
              <td style={officialTdLeft}>{item}</td>
              {aspect.scaleLabels.map((_, s) => <td key={s} style={officialTd}>{record.scores[String(i)] === s ? '✓' : ''}</td>)}
              <td style={officialTdLeft}>{record.itemNotes?.[String(i)] || ''}</td>
            </tr>
          ))}
          <tr><td style={officialTd} colSpan={2}>รวมทั้งสิ้น</td><td style={officialTd} colSpan={aspect.maxPerItem + 1}>{record.total} / {record.max}</td><td style={officialTd} /></tr>
          <tr><td style={officialTd} colSpan={2}>คิดเป็นร้อยละ</td><td style={officialTd} colSpan={aspect.maxPerItem + 1}>{formatPercent(record.percent)} ({record.level})</td><td style={officialTd} /></tr>
        </tbody>
      </table>
      <div style={{ marginTop: '8pt' }}><b>ข้อเสนอแนะของคณะกรรมการฯ</b> {record.suggestion || '.'.repeat(120)}</div>
      {record.otherWork && <div style={{ marginTop: '6pt' }}><b>งานอื่น ๆ ที่ได้รับมอบหมาย</b> {record.otherWork}</div>}
      <div style={{ marginTop: '6pt' }}>
        <b>สรุปผลการนิเทศ</b>{' '}
        {SUPERVISION_LEVELS.map((l, i) => {
          const max = i === 0 ? 100 : SUPERVISION_LEVELS[i - 1].min - 1;
          return <span key={l.label} style={{ marginRight: '10pt' }}>{record.level === l.label ? '☑' : '☐'} {l.min}-{max} {l.label}</span>;
        })}
      </div>
      <div className="official-signatures" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[
          { role: 'ผู้รับการนิเทศ', name: record.teacherName },
          { role: 'ประธานกรรมการ', name: record.committee?.chair },
          { role: 'กรรมการ', name: record.committee?.member },
          { role: 'กรรมการและเลขานุการ', name: record.committee?.secretary },
        ].map(s => (
          <div key={s.role} className="official-signer">
            <div>ลงชื่อ ........................................</div>
            <div>({s.name || '........................................'})</div>
            <div>{s.role}</div>
          </div>
        ))}
      </div>
    </OfficialDocument>
  );
}

// ─────────────────────────────── teacher view ───────────────────────────────

function TeacherView({ email, name }: { email: string; name: string }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [records, setRecords] = useState<SupervisionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [round, setRound] = useState<SupervisionRound | null>(null);
  const myEmail = normalizeEmail(email);

  useEffect(() => {
    if (!myEmail) { setLoaded(true); return; }
    const q = query(collection(db, SUPERVISION_COLLECTION), where('teacherEmail', '==', myEmail));
    return onSnapshot(q, snap => {
      setRecords(snap.docs.map(d => ({ ...(d.data() as SupervisionRecord), id: d.id })));
      setLoaded(true);
    }, err => { console.error('supervision load failed', err); setLoaded(true); });
  }, [myEmail]);

  const yearRecords = records.filter(r => r.year === year);
  const selected = round ? yearRecords.find(r => r.round === round) : undefined;
  useEffect(() => {
    // เปิดครั้งล่าสุดที่มีผลให้อัตโนมัติ
    const latest = [...yearRecords].sort((a, b) => b.round - a.round)[0];
    setRound(latest ? latest.round : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, records.length]);

  const yearsWithData = [...new Set(records.map(r => r.year))].filter(y => y !== year).sort((a, b) => b - a);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <PageTitle subtitle={`ผลการนิเทศของ ${name} (ดูได้อย่างเดียว)`} year={year} setYear={setYear} />
      <div className="sup-screen">
        {!loaded ? (
          <div style={card}>กำลังโหลด...</div>
        ) : !myEmail ? (
          <div style={card}>บัญชีนี้ไม่มีอีเมล จึงจับคู่ผลการนิเทศไม่ได้ กรุณาแจ้งผู้ดูแลระบบ</div>
        ) : (
          <>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>สรุปผลการนิเทศ ปีการศึกษา {year}</div>
              <SummaryTable records={yearRecords} year={year} onOpen={setRound} selectedRound={round} />
              {yearsWithData.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 14, color: '#64748B' }}>
                  มีผลการนิเทศปีการศึกษาอื่น:{' '}
                  {yearsWithData.map(y => (
                    <button key={y} onClick={() => setYear(y)} style={{ ...btn('#EEF2FF', '#4338CA'), padding: '3px 10px', marginRight: 6 }}>{y}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {SUPERVISION_ROUNDS.map(r => {
                const has = yearRecords.some(x => x.round === r);
                return (
                  <button
                    key={r}
                    disabled={!has}
                    onClick={() => setRound(r)}
                    style={{ ...btn(round === r ? '#7C3AED' : '#F1F5F9', round === r ? '#fff' : has ? '#334155' : '#94A3B8'), cursor: has ? 'pointer' : 'not-allowed' }}
                  >
                    ครั้งที่ {r} · {aspectForRound(r).title}
                  </button>
                );
              })}
            </div>
            {selected ? (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button onClick={() => window.print()} style={btn('#0F172A')}><Printer size={16} /> พิมพ์แบบนิเทศครั้งนี้</button>
                </div>
                <RecordDetail record={selected} />
              </div>
            ) : (
              <div style={{ ...card, color: '#64748B' }}>ยังไม่มีผลการนิเทศในปีการศึกษา {year}</div>
            )}
          </>
        )}
      </div>
      {selected && <div className="sup-print"><PrintRecord record={selected} /></div>}
    </div>
  );
}

// ─────────────────────────────── admin view ───────────────────────────────

interface Draft {
  teacherEmail: string;
  teacherName: string;
  round: SupervisionRound;
  aspect: SupervisionAspectId;
  date: string;
  teaching: string;
  homeroom: string;
  scores: SupervisionScores;
  itemNotes: Record<string, string>;
  suggestion: string;
  otherWork: string;
  photoText: string;
  chair: string;
  member: string;
  secretary: string;
}

const emptyDraft = (round: SupervisionRound = 1, teacher?: StaffOption): Draft => ({
  teacherEmail: teacher?.email || '',
  teacherName: teacher?.name || '',
  round,
  aspect: aspectForRound(round).id,
  date: todayIso(),
  teaching: '',
  homeroom: '',
  scores: {},
  itemNotes: {},
  suggestion: '',
  otherWork: '',
  photoText: '',
  chair: '',
  member: '',
  secretary: '',
});

const draftFromRecord = (r: SupervisionRecord): Draft => ({
  teacherEmail: r.teacherEmail,
  teacherName: r.teacherName,
  round: r.round,
  aspect: r.aspect,
  date: r.date,
  teaching: r.teaching || '',
  homeroom: r.homeroom || '',
  scores: { ...r.scores },
  itemNotes: { ...(r.itemNotes || {}) },
  suggestion: r.suggestion || '',
  otherWork: r.otherWork || '',
  photoText: (r.photoLinks || []).join('\n'),
  chair: r.committee?.chair || '',
  member: r.committee?.member || '',
  secretary: r.committee?.secretary || '',
});

function AdminView({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [records, setRecords] = useState<SupervisionRecord[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<SupervisionRecord | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, SUPERVISION_COLLECTION), where('year', '==', year));
    return onSnapshot(q, snap => setRecords(snap.docs.map(d => ({ ...(d.data() as SupervisionRecord), id: d.id }))),
      err => console.error('supervision load failed', err));
  }, [year]);

  useEffect(() => {
    getDocs(collection(db, STAFF_USERS_COLLECTION)).then(snap => {
      const list = snap.docs
        .map(d => d.data() as { email?: string; name?: string; active?: boolean })
        .filter(s => s.active !== false && s.email)
        .map(s => ({ email: normalizeEmail(s.email!), name: s.name || s.email! }))
        .sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setStaff(list);
    }).catch(err => console.error('staff list failed', err));
  }, []);

  // ครูที่แสดงในตาราง: ทุกคนในรายชื่อบุคลากร + คนที่มีผลการนิเทศแล้วแต่ไม่อยู่ในรายชื่อ
  const teachers = useMemo(() => {
    const map = new Map<string, StaffOption>();
    staff.forEach(s => map.set(s.email, s));
    records.forEach(r => { if (!map.has(r.teacherEmail)) map.set(r.teacherEmail, { email: r.teacherEmail, name: r.teacherName }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'));
  }, [staff, records]);

  const recordFor = (email: string, round: SupervisionRound) => records.find(r => r.teacherEmail === email && r.round === round);

  const openCell = (t: StaffOption, round: SupervisionRound) => {
    const r = recordFor(t.email, round);
    setMsg(null);
    if (r) { setViewing(r); setDraft(null); } else { setDraft(emptyDraft(round, t)); setViewing(null); }
    setTimeout(() => document.getElementById('sup-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const done = records.length;
  const avgAll = done ? records.reduce((s, r) => s + r.percent, 0) / done : null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageTitle subtitle="บันทึกผลการนิเทศ (เฉพาะผู้ดูแลระบบ) · นิเทศ 3 ครั้ง ครั้งละ 1 ด้าน" year={year} setYear={setYear} />
      <div className="sup-screen">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
          <Stat title="บันทึกแล้ว" value={`${done} / ${teachers.length * 3} ครั้ง`} />
          {SUPERVISION_ROUNDS.map(r => {
            const list = records.filter(x => x.round === r);
            const avg = list.length ? list.reduce((s, x) => s + x.percent, 0) / list.length : null;
            return <Stat key={r} title={`ครั้งที่ ${r} ${aspectForRound(r).title} (เฉลี่ย)`} value={avg === null ? '-' : formatPercent(avg)} color={avg === null ? '#94A3B8' : levelColor(avg)} />;
          })}
          <Stat title="เฉลี่ยทั้งโรงเรียน" value={avgAll === null ? '-' : formatPercent(avgAll)} color={avgAll === null ? '#94A3B8' : levelColor(avgAll)} />
        </div>

        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>ภาพรวมผลการนิเทศรายบุคคล ปีการศึกษา {year}</div>
            <button onClick={() => { setDraft(emptyDraft(1)); setViewing(null); setMsg(null); }} style={btn('#7C3AED')}><Pencil size={16} /> บันทึกผลการนิเทศ</button>
          </div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 10 }}>กดช่องที่มีคะแนนเพื่อดูรายละเอียด/แก้ไข · กดช่อง "+ บันทึก" เพื่อบันทึกผลครั้งนั้น</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F1F5F9' }}>
                  <th style={{ ...th, textAlign: 'left' }}>ผู้รับการนิเทศ</th>
                  {SUPERVISION_ROUNDS.map(r => <th key={r} style={th}>ครั้งที่ {r}<br /><span style={{ fontWeight: 500, fontSize: 12 }}>{aspectForRound(r).title}</span></th>)}
                  <th style={th}>เฉลี่ยร้อยละ</th>
                  <th style={th}>ระดับ</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 && <tr><td style={td} colSpan={6}>ยังไม่มีรายชื่อครู (เพิ่มได้ที่ จัดการเว็บไซต์ › ผู้ใช้งาน) หรือกด "บันทึกผลการนิเทศ" แล้วกรอกอีเมลครู</td></tr>}
                {teachers.map(t => {
                  const s = summarizeSupervision(records.filter(r => r.teacherEmail === t.email), year);
                  return (
                    <tr key={t.email}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>{t.email}</div>
                      </td>
                      {s.rounds.map(({ round, record }) => (
                        <td key={round} style={{ ...td, cursor: 'pointer' }} onClick={() => openCell(t, round)}>
                          {record
                            ? <span style={{ fontWeight: 800, color: levelColor(record.percent) }}>{formatPercent(record.percent)}</span>
                            : <span style={{ color: '#7C3AED', fontWeight: 600 }}>+ บันทึก</span>}
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight: 800, color: s.averagePercent === null ? '#94A3B8' : levelColor(s.averagePercent) }}>
                        {s.averagePercent === null ? '-' : formatPercent(s.averagePercent)}
                      </td>
                      <td style={td}>{s.averagePercent === null ? '-' : <LevelBadge percent={s.averagePercent} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {msg && (
          <div style={{ ...card, padding: 12, background: msg.ok ? '#ECFDF5' : '#FEF2F2', color: msg.ok ? '#047857' : '#B91C1C', fontWeight: 700 }}>{msg.text}</div>
        )}

        <div id="sup-panel">
          {viewing && !draft && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{viewing.teacherName}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => window.print()} style={btn('#0F172A')}><Printer size={16} /> พิมพ์</button>
                  <button onClick={() => { setDraft(draftFromRecord(viewing)); }} style={btn('#7C3AED')}><Pencil size={16} /> แก้ไข</button>
                  <button onClick={() => setViewing(null)} style={btn('#F1F5F9', '#334155')}><X size={16} /> ปิด</button>
                </div>
              </div>
              <SummaryTable
                records={records.filter(r => r.teacherEmail === viewing.teacherEmail)}
                year={year}
                selectedRound={viewing.round}
                onOpen={round => { const r = recordFor(viewing.teacherEmail, round); if (r) setViewing(r); }}
              />
              <div style={{ height: 18 }} />
              <RecordDetail record={viewing} />
            </div>
          )}
          {draft && (
            <EntryForm
              key={`${draft.teacherEmail}_${draft.round}`}
              initial={draft}
              year={year}
              staff={teachers}
              records={records}
              saving={saving}
              onCancel={() => setDraft(null)}
              onSave={async d => {
                const email = normalizeEmail(d.teacherEmail);
                if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg({ ok: false, text: 'กรุณาเลือกครู หรือกรอกอีเมลครูให้ถูกต้อง' }); return; }
                if (!d.teacherName.trim()) { setMsg({ ok: false, text: 'กรุณากรอกชื่อผู้รับการนิเทศ' }); return; }
                const result = scoreSupervision(d.aspect, d.scores);
                if (result.missing) { setMsg({ ok: false, text: `ยังไม่ได้ให้คะแนน ${result.missing} ข้อ` }); return; }
                const id = supervisionDocId(year, email, d.round);
                const record: SupervisionRecord = {
                  id, year, round: d.round, aspect: d.aspect, date: d.date || todayIso(),
                  teacherEmail: email, teacherName: d.teacherName.trim(),
                  teaching: d.teaching.trim(), homeroom: d.homeroom.trim(),
                  scores: d.scores,
                  itemNotes: Object.fromEntries(Object.entries(d.itemNotes).filter(([, v]) => v.trim())),
                  suggestion: d.suggestion.trim(), otherWork: d.otherWork.trim(),
                  photoLinks: cleanPhotoLinks(d.photoText),
                  committee: { chair: d.chair.trim(), member: d.member.trim(), secretary: d.secretary.trim() },
                  total: result.total, max: result.max, percent: result.percent, level: result.level,
                  updatedAt: Date.now(), updatedBy: adminEmail || adminName,
                };
                setSaving(true);
                try {
                  await setDoc(doc(db, SUPERVISION_COLLECTION, id), record);
                  setDraft(null);
                  setViewing(record);
                  setMsg({ ok: true, text: `บันทึกผลการนิเทศครั้งที่ ${d.round} ของ ${record.teacherName} แล้ว (ร้อยละ ${formatPercent(record.percent)} ${record.level})` });
                } catch (err) {
                  console.error(err);
                  setMsg({ ok: false, text: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' });
                } finally {
                  setSaving(false);
                }
              }}
              onDelete={async d => {
                const id = supervisionDocId(year, d.teacherEmail, d.round);
                if (!window.confirm(`ลบผลการนิเทศครั้งที่ ${d.round} ของ ${d.teacherName}?`)) return;
                try {
                  await deleteDoc(doc(db, SUPERVISION_COLLECTION, id));
                  setDraft(null); setViewing(null);
                  setMsg({ ok: true, text: 'ลบผลการนิเทศแล้ว' });
                } catch (err) {
                  console.error(err);
                  setMsg({ ok: false, text: 'ลบไม่สำเร็จ' });
                }
              }}
            />
          )}
        </div>
      </div>
      {viewing && !draft && <div className="sup-print"><PrintRecord record={viewing} /></div>}
    </div>
  );
}

function EntryForm({ initial, year, staff, records, saving, onCancel, onSave, onDelete }: {
  initial: Draft;
  year: number;
  staff: StaffOption[];
  records: SupervisionRecord[];
  saving: boolean;
  onCancel: () => void;
  onSave: (d: Draft) => void;
  onDelete: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(prev => ({ ...prev, [k]: v }));
  const aspect = getAspect(d.aspect)!;
  const result = scoreSupervision(d.aspect, d.scores);
  const existing = records.find(r => r.teacherEmail === normalizeEmail(d.teacherEmail) && r.round === d.round);
  const links = cleanPhotoLinks(d.photoText);
  const inStaff = staff.some(s => s.email === normalizeEmail(d.teacherEmail));

  return (
    <div style={{ ...card, borderColor: '#C4B5FD' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{existing ? 'แก้ไขผลการนิเทศ' : 'บันทึกผลการนิเทศ'} · ปีการศึกษา {year}</div>
        <button onClick={onCancel} style={btn('#F1F5F9', '#334155')}><X size={16} /> ยกเลิก</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div>
          <label style={label} htmlFor="sup-teacher">ผู้รับการนิเทศ</label>
          <select
            id="sup-teacher"
            style={input}
            value={inStaff ? normalizeEmail(d.teacherEmail) : '__other'}
            onChange={e => {
              const s = staff.find(x => x.email === e.target.value);
              setD(prev => ({ ...prev, teacherEmail: s ? s.email : '', teacherName: s ? s.name : '' }));
            }}
          >
            <option value="__other">— เลือกครู / กรอกเอง —</option>
            {staff.map(s => <option key={s.email} value={s.email}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="sup-name">ชื่อ-สกุล (พิมพ์ในแบบนิเทศ)</label>
          <input id="sup-name" style={input} value={d.teacherName} onChange={e => set('teacherName', e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="sup-email">อีเมลบัญชีครู (ใช้ให้ครูเห็นผลของตนเอง)</label>
          <input id="sup-email" style={input} type="email" value={d.teacherEmail} onChange={e => set('teacherEmail', e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="sup-round">นิเทศครั้งที่</label>
          <select
            id="sup-round"
            style={input}
            value={d.round}
            onChange={e => {
              const r = Number(e.target.value) as SupervisionRound;
              setD(prev => ({ ...prev, round: r, aspect: aspectForRound(r).id, scores: {}, itemNotes: {} }));
            }}
          >
            {SUPERVISION_ROUNDS.map(r => <option key={r} value={r}>ครั้งที่ {r} — {aspectForRound(r).title}</option>)}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="sup-aspect">ด้านที่นิเทศ</label>
          <select
            id="sup-aspect"
            style={input}
            value={d.aspect}
            onChange={e => setD(prev => ({ ...prev, aspect: Number(e.target.value) as SupervisionAspectId, scores: {}, itemNotes: {} }))}
          >
            {SUPERVISION_ASPECTS.map(a => <option key={a.id} value={a.id}>{a.id}. {a.title}</option>)}
          </select>
        </div>
        <div>
          <label style={label} htmlFor="sup-date">วันที่นิเทศ</label>
          <input id="sup-date" style={input} type="date" value={d.date} onChange={e => set('date', e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="sup-teaching">รับผิดชอบงานสอน</label>
          <input id="sup-teaching" style={input} value={d.teaching} placeholder="เช่น คณิตศาสตร์ ป.4-6" onChange={e => set('teaching', e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="sup-homeroom">งานประจำชั้น</label>
          <input id="sup-homeroom" style={input} value={d.homeroom} placeholder="เช่น ป.4/1" onChange={e => set('homeroom', e.target.value)} />
        </div>
      </div>

      {existing && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 10, background: '#FFFBEB', color: '#92400E', fontSize: 14 }}>
          ครูคนนี้มีผลการนิเทศครั้งที่ {d.round} แล้ว — บันทึกจะแทนที่ผลเดิม
        </div>
      )}

      <div style={{ marginTop: 18, fontWeight: 800, fontSize: 16 }}>{aspect.id}. {aspect.title}</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>
        เกณฑ์: {aspect.scaleLabels.map((l, i) => `${i} = ${l}`).join(' · ')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {aspect.scaleLabels.map((_, v) => (
          <button
            key={v}
            type="button"
            onClick={() => set('scores', Object.fromEntries(aspect.items.map((_, i) => [String(i), v])))}
            style={{ ...btn('#F5F3FF', '#6D28D9'), padding: '5px 12px', fontSize: 13 }}
          >
            ให้ {v} ทุกข้อ
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#F1F5F9' }}>
              <th style={th}>ที่</th>
              <th style={{ ...th, textAlign: 'left' }}>รายการนิเทศ</th>
              {aspect.scaleLabels.map((l, i) => <th key={i} style={{ ...th, whiteSpace: 'normal', maxWidth: 120, fontSize: 12 }}>{l}<br />({i})</th>)}
              <th style={{ ...th, textAlign: 'left' }}>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {aspect.items.map((item, i) => (
              <tr key={i} style={{ background: typeof d.scores[String(i)] === 'number' ? undefined : '#FFFBEB' }}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, textAlign: 'left' }}>{item}</td>
                {aspect.scaleLabels.map((_, v) => (
                  <td key={v} style={td}>
                    <input
                      type="radio"
                      name={`score-${i}`}
                      aria-label={`ข้อ ${i + 1} ได้ ${v} คะแนน`}
                      checked={d.scores[String(i)] === v}
                      onChange={() => set('scores', { ...d.scores, [String(i)]: v })}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                  </td>
                ))}
                <td style={td}>
                  <input
                    style={{ ...input, padding: '5px 8px', fontSize: 13, minWidth: 120 }}
                    value={d.itemNotes[String(i)] || ''}
                    aria-label={`หมายเหตุข้อ ${i + 1}`}
                    onChange={e => set('itemNotes', { ...d.itemNotes, [String(i)]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 14 }}>
        <Stat title="รวมทั้งสิ้น" value={`${result.total} / ${result.max}`} />
        <Stat title="คิดเป็นร้อยละ" value={formatPercent(result.percent)} color={levelColor(result.percent)} />
        <Stat title="ระดับ" value={result.missing ? `ยังไม่ครบ (${result.missing} ข้อ)` : result.level} color={result.missing ? '#B45309' : levelColor(result.percent)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 16 }}>
        <div>
          <label style={label} htmlFor="sup-suggestion">ข้อเสนอแนะของคณะกรรมการ</label>
          <textarea id="sup-suggestion" style={{ ...input, minHeight: 100 }} value={d.suggestion} onChange={e => set('suggestion', e.target.value)} />
        </div>
        <div>
          <label style={label} htmlFor="sup-other">งานอื่น ๆ ที่ได้รับมอบหมาย</label>
          <textarea id="sup-other" style={{ ...input, minHeight: 100 }} value={d.otherWork} onChange={e => set('otherWork', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={label} htmlFor="sup-photos">ลิงก์รูปภาพประกอบ (Google Drive / Google Photos ฯลฯ) — บรรทัดละ 1 ลิงก์</label>
        <textarea id="sup-photos" style={{ ...input, minHeight: 80, fontFamily: 'monospace', fontSize: 13 }} value={d.photoText} placeholder="https://drive.google.com/file/d/.../view" onChange={e => set('photoText', e.target.value)} />
        <div style={{ fontSize: 13, color: '#64748B', margin: '4px 0 8px' }}>ลิงก์ที่ใช้ได้: {links.length} ลิงก์ (ตั้งค่าแชร์ไฟล์เป็น "ทุกคนที่มีลิงก์" เพื่อให้ครูเปิดดูได้)</div>
        {links.length > 0 && <PhotoLinks links={links} />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
        <div><label style={label} htmlFor="sup-chair">ประธานกรรมการ</label><input id="sup-chair" style={input} value={d.chair} onChange={e => set('chair', e.target.value)} /></div>
        <div><label style={label} htmlFor="sup-member">กรรมการ</label><input id="sup-member" style={input} value={d.member} onChange={e => set('member', e.target.value)} /></div>
        <div><label style={label} htmlFor="sup-secretary">กรรมการและเลขานุการ</label><input id="sup-secretary" style={input} value={d.secretary} onChange={e => set('secretary', e.target.value)} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button disabled={saving} onClick={() => onSave(d)} style={{ ...btn('#7C3AED'), opacity: saving ? 0.6 : 1 }}>
          <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกผลการนิเทศ'}
        </button>
        {existing && <button onClick={() => onDelete(d)} style={btn('#FEE2E2', '#B91C1C')}><Trash2 size={16} /> ลบผลครั้งนี้</button>}
      </div>
    </div>
  );
}
