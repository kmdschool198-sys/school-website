import { useState, useEffect, useMemo } from 'react';
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch,
  query, where, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { Plus, Trash2, Eye, EyeOff, Edit2, X, Save, RefreshCw } from 'lucide-react';
import type { ResultAnnouncement, ResultRow } from '../data/results';
import {
  subjectsFromTimetable, totalScore, pctColor,
  normalizeResultCode, publicAnnouncementFromResult, resultLookupDocId,
} from '../data/results';

const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

async function commitBatched(actions: Array<(batch: ReturnType<typeof writeBatch>) => void>) {
  let batch = writeBatch(db);
  let count = 0;
  for (const action of actions) {
    action(batch);
    count += 1;
    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

async function deletePublicResult(announcementId: string) {
  const lookupSnap = await getDocs(
    query(collection(db, 'result_lookup'), where('announcementId', '==', announcementId)),
  );
  await commitBatched([
    batch => batch.delete(doc(db, 'result_announcements', announcementId)),
    ...lookupSnap.docs.map(d => (batch: ReturnType<typeof writeBatch>) => batch.delete(d.ref)),
  ]);
}

async function syncPublicResult(result: ResultAnnouncement) {
  await deletePublicResult(result.id);
  if (!result.visible) return;

  const records = result.records
    .map(row => ({ ...row, code: normalizeResultCode(row.code) }))
    .filter(row => row.code);

  await commitBatched([
    batch => batch.set(
      doc(db, 'result_announcements', result.id),
      publicAnnouncementFromResult(result, records.length),
    ),
    ...records.map(row => (batch: ReturnType<typeof writeBatch>) => batch.set(
      doc(db, 'result_lookup', resultLookupDocId(result.id, row.code)),
      {
        ...row,
        announcementId: result.id,
        className: result.className,
        publishedAt: result.publishedAt,
        visible: true,
        recordCount: records.length,
      },
    )),
  ]);
}

export default function ResultsManager() {
  const [items, setItems] = useState<ResultAnnouncement[]>([]);
  const [editing, setEditing] = useState<ResultAnnouncement | null>(null);
  const [classes, setClasses] = useState<ClassRoster[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, 'results'), snap => {
      const arr: ResultAnnouncement[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => b.publishedAt - a.publishedAt);
      setItems(arr);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) setClasses(d.classes);
      }
    });
  }, []);

  const availableClasses = useMemo(() => {
    try {
      const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
      const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
      const all = [...KG, ...rooms];
      return all.map(r => {
        const fromCloud = classes.find(c => c.classId === r.id);
        return { id: r.id, label: r.label, students: fromCloud?.students || [] };
      });
    } catch { return classes.map(c => ({ id: c.classId, label: c.label, students: c.students })); }
  }, [classes]);

  const create = () => {
    const cls = availableClasses[0];
    const subjects = subjectsFromTimetable(cls?.id || '');
    setEditing({
      id: `res_${Date.now()}`,
      title: `ผลสอบปลายภาค ${new Date().getFullYear() + 543}`,
      classId: cls?.id || '',
      className: cls?.label || '',
      subjects,
      records: cls?.students.map(s => ({
        code: s.code || s.id, name: s.name, scores: {}, note: '',
      })) || [],
      publishedAt: Date.now(),
      visible: false,
    });
  };

  const save = async (a: ResultAnnouncement) => {
    try {
      // Auto-rank by total score
      const ranked = [...a.records].map(r => ({
        ...r, _total: totalScore(r.scores, a.subjects).sum,
      })).sort((x, y) => y._total - x._total);
      const rankMap = new Map<string, number>();
      ranked.forEach((r, i) => rankMap.set(r.code, i + 1));
      const records = a.records.map(r => ({ ...r, rank: rankMap.get(r.code) }));
      const next = { ...a, records };
      await setDoc(doc(db, 'results', a.id), next);
      await syncPublicResult(next);
      setEditing(null);
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const toggle = async (a: ResultAnnouncement) => {
    try {
      const next = { ...a, visible: !a.visible };
      await setDoc(doc(db, 'results', a.id), next);
      await syncPublicResult(next);
    }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const del = async (a: ResultAnnouncement) => {
    if (!confirm(`ลบประกาศ "${a.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'results', a.id));
      await deletePublicResult(a.id);
    }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <h6 style={{ margin: 0, flex: 1, fontWeight: 800 }}>📢 ประกาศผลสอบนักเรียน ({items.length})</h6>
        <button onClick={create} style={btnPrimary}>
          <Plus size={14} /> สร้างประกาศใหม่
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
          ยังไม่มีประกาศ — กดปุ่ม "สร้างประกาศใหม่" เพื่อเริ่มต้น
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {items.map(a => (
            <div key={a.id} style={{
              background: 'white', borderRadius: 12, padding: '1rem',
              border: a.visible ? '2px solid #10B981' : '2px solid #FEE2E2',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                  background: a.visible ? '#DCFCE7' : '#FEE2E2',
                  color: a.visible ? '#166534' : '#991B1B',
                }}>{a.visible ? '🟢 เผยแพร่' : '🔴 ซ่อน'}</span>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  {new Date(a.publishedAt).toLocaleDateString('th-TH')}
                </span>
              </div>
              <div style={{ fontWeight: 900, color: '#0F172A', marginBottom: 4 }}>{a.title || '(ไม่มีชื่อ)'}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: 10 }}>
                ชั้น {a.className} · {a.records.length} คน · {a.subjects.length} วิชา
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(a)} style={btnSm}><Edit2 size={12} /> แก้ไข</button>
                <button onClick={() => toggle(a)} style={btnSm}>
                  {a.visible ? <><EyeOff size={12} /> ซ่อน</> : <><Eye size={12} /> เผยแพร่</>}
                </button>
                <button onClick={() => del(a)} style={{ ...btnSm, color: '#DC2626' }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && <Editor item={editing} availableClasses={availableClasses} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}

function Editor({ item, availableClasses, onSave, onCancel }: {
  item: ResultAnnouncement;
  availableClasses: Array<{ id: string; label: string; students: Student[] }>;
  onSave: (a: ResultAnnouncement) => void; onCancel: () => void;
}) {
  const [a, setA] = useState(item);

  const refreshFromSource = (newClassId?: string) => {
    const classId = newClassId || a.classId;
    const cls = availableClasses.find(c => c.id === classId);
    if (!cls) return;
    const newSubjects = subjectsFromTimetable(classId);
    // Preserve existing maxScore for matching subjects
    const subjects = newSubjects.map(s => {
      const old = a.subjects.find(x => x.name === s.name);
      return old ? { ...s, maxScore: old.maxScore } : s;
    });
    const newRecords: ResultRow[] = cls.students.map(s => {
      const existing = a.records.find(r => r.code === (s.code || s.id));
      return existing
        ? { ...existing, name: s.name, code: s.code || s.id }
        : { code: s.code || s.id, name: s.name, scores: {}, note: '' };
    });
    setA({ ...a, classId, className: cls.label, subjects, records: newRecords });
  };

  const updateScore = (code: string, subjName: string, value: string) => {
    if (value === '') {
      setA(prev => ({
        ...prev,
        records: prev.records.map(r => r.code === code
          ? { ...r, scores: Object.fromEntries(Object.entries(r.scores).filter(([k]) => k !== subjName)) }
          : r),
      }));
      return;
    }
    const subject = a.subjects.find(s => s.name === subjName);
    const max = subject?.maxScore || 100;
    const num = Math.max(0, Math.min(max, Number(value) || 0));
    setA(prev => ({
      ...prev,
      records: prev.records.map(r => r.code === code
        ? { ...r, scores: { ...r.scores, [subjName]: num } }
        : r),
    }));
  };

  const updateNote = (code: string, note: string) => {
    setA(prev => ({
      ...prev,
      records: prev.records.map(r => r.code === code ? { ...r, note } : r),
    }));
  };

  const updateMaxScore = (subjName: string, max: number) => {
    setA(prev => ({
      ...prev,
      subjects: prev.subjects.map(s => s.name === subjName ? { ...s, maxScore: max } : s),
    }));
  };

  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 16, maxWidth: 1200, width: '100%',
        maxHeight: '92vh', overflow: 'auto', padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <h5 style={{ margin: 0, fontWeight: 900, flex: 1 }}>✏️ แก้ไขประกาศผลสอบ</h5>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Top form */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <label style={lbl}>ชื่อประกาศ *</label>
            <input value={a.title} onChange={e => setA({ ...a, title: e.target.value })}
              placeholder="เช่น ผลสอบปลายภาคเรียนที่ 1/2569" style={inp} />
          </div>
          <div>
            <label style={lbl}>ชั้นเรียน *</label>
            <select value={a.classId} onChange={e => refreshFromSource(e.target.value)} style={inp}>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.label} ({c.students.length} คน)</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>สถานะ</label>
            <select value={String(a.visible)} onChange={e => setA({ ...a, visible: e.target.value === 'true' })} style={inp}>
              <option value="false">🔴 ซ่อน</option>
              <option value="true">🟢 เผยแพร่</option>
            </select>
          </div>
        </div>

        <div style={{
          background: '#FFF7ED', border: '1px dashed #FFD7B0', borderRadius: 10,
          padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <button onClick={() => refreshFromSource()} style={{ ...btnSm, background: '#3B82F6', color: 'white' }}>
            <RefreshCw size={12} /> ดึงรายวิชา + นักเรียนใหม่
          </button>
          <span style={{ fontSize: '0.78rem', color: '#7C2D12' }}>
            💡 ดึงจาก<b>ตารางสอนจริง</b> + <b>รายชื่อนักเรียน</b> · ตอนนี้: {a.subjects.length} วิชา · {a.records.length} คน
          </span>
        </div>

        {/* MaxScore editor — visible by default */}
        {a.subjects.length > 0 && (
          <div style={{ marginBottom: 14, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#92400E', marginBottom: 8 }}>
              📐 คะแนนเต็มแต่ละวิชา (กำหนดก่อนกรอกคะแนน)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
              {a.subjects.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', background: 'white', padding: '6px 10px', borderRadius: 6 }}>
                  <span style={{ flex: 1, color: '#0F172A', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>เต็ม</span>
                  <input type="number" min="1" max="200" step="1"
                    value={s.maxScore || 0}
                    onChange={e => updateMaxScore(s.name, Number(e.target.value) || 1)}
                    style={{ width: 60, padding: 4, borderRadius: 6, border: '1px solid #E2E8F0', textAlign: 'center', fontWeight: 700 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score grid */}
        {a.records.length === 0 ? (
          <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#92400E' }}>
            ⚠️ ชั้นนี้ยังไม่มีรายชื่อนักเรียน — กรุณาเพิ่มในแท็บ "รายชื่อ-เช็คชื่อ" ก่อน
          </div>
        ) : a.subjects.length === 0 ? (
          <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '2rem', textAlign: 'center', color: '#92400E' }}>
            ⚠️ ไม่พบรายวิชาในตารางสอนของชั้นนี้
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                  <th style={{ ...th, position: 'sticky', left: 0, background: '#0F172A', minWidth: 40 }}>#</th>
                  <th style={{ ...th, position: 'sticky', left: 40, background: '#0F172A', minWidth: 80 }}>รหัส</th>
                  <th style={{ ...th, position: 'sticky', left: 120, background: '#0F172A', minWidth: 180, textAlign: 'left' }}>ชื่อ-สกุล</th>
                  {a.subjects.map(s => (
                    <th key={s.name} style={{ ...th, minWidth: 90 }} title={`ครู: ${s.teacher || '-'}`}>
                      <div>{s.name}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 600 }}>(เต็ม {s.maxScore})</div>
                    </th>
                  ))}
                  <th style={{ ...th, background: '#7C2D12', minWidth: 100 }}>รวม</th>
                  <th style={{ ...th, minWidth: 130 }}>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {a.records.map((r, i) => {
                  const t = totalScore(r.scores, a.subjects);
                  return (
                    <tr key={r.code} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                      <td style={{ ...td, position: 'sticky', left: 0, background: i % 2 ? 'white' : '#FFFBF5' }}>{i + 1}</td>
                      <td style={{ ...td, position: 'sticky', left: 40, background: i % 2 ? 'white' : '#FFFBF5', fontSize: '0.78rem' }}>{r.code}</td>
                      <td style={{ ...td, position: 'sticky', left: 120, background: i % 2 ? 'white' : '#FFFBF5', textAlign: 'left', fontWeight: 700 }}>{r.name}</td>
                      {a.subjects.map(s => (
                        <td key={s.name} style={td}>
                          <input type="number" min={0} max={s.maxScore} step="0.5"
                            value={r.scores[s.name] ?? ''}
                            onChange={e => updateScore(r.code, s.name, e.target.value)}
                            style={{
                              width: 70, padding: '4px 6px', borderRadius: 6,
                              border: '1px solid #E2E8F0', textAlign: 'center',
                              fontWeight: 700, fontSize: '0.85rem',
                            }} />
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight: 900, color: pctColor(t.pct) }}>
                        <div>{t.sum.toFixed(1)} / {t.max}</div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.7 }}>{t.pct.toFixed(1)}%</div>
                      </td>
                      <td style={td}>
                        <input value={r.note || ''} onChange={e => updateNote(r.code, e.target.value)}
                          style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: '0.78rem', color: '#94A3B8' }}>
          💡 กรอกคะแนนที่ได้ (ไม่เกินคะแนนเต็มของวิชานั้น) · ระบบจะคำนวณ <b>คะแนนรวม</b> และ <b>เปอร์เซ็นต์</b> ให้อัตโนมัติ · จัดอันดับตามคะแนนรวมเมื่อกดบันทึก
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>ยกเลิก</button>
          <button onClick={() => onSave(a)} disabled={!a.title || a.records.length === 0 || a.subjects.length === 0}
            style={{ ...btnPrimary, opacity: (!a.title || a.records.length === 0 || a.subjects.length === 0) ? 0.4 : 1 }}>
            <Save size={14} /> บันทึก + จัดอันดับ
          </button>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnPrimary: React.CSSProperties = { background: '#FF6A01', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
const btnSm: React.CSSProperties = { background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' };
const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'center', fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'center' };
