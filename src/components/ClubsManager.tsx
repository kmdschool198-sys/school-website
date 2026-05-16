import { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { Plus, Trash2, Edit2, Save, X, Users, UserPlus, List, Grid } from 'lucide-react';
import type { Club, ClubType, ClubMember } from '../data/clubs';

const KG = [{ id: 'kg_a2_1', label: 'อ.2/1' }, { id: 'kg_a3_1', label: 'อ.3/1' }];
const TYPES: ClubType[] = ['ชุมนุม', 'ลูกเสือ-เนตรนารี', 'กิจกรรมพัฒนาผู้เรียน', 'อื่น ๆ'];

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

export default function ClubsManager() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [classes, setClasses] = useState<ClassRoster[]>([]);
  const [editing, setEditing] = useState<Club | null>(null);
  const [view, setView] = useState<'cards' | 'roster'>('cards');

  useEffect(() => {
    return onSnapshot(collection(db, 'clubs'), snap => {
      const arr: Club[] = [];
      snap.forEach(d => arr.push({ id: d.id, ...(d.data() as any) }));
      arr.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setClubs(arr);
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

  const allRooms = useMemo(() => {
    try {
      const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
      const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
      const all = [...KG, ...rooms];
      return all.map(r => {
        const fromCloud = classes.find(c => c.classId === r.id);
        return { id: r.id, label: r.label, students: fromCloud?.students || [] };
      });
    } catch { return []; }
  }, [classes]);

  const create = () => setEditing({
    id: `club_${Date.now()}`, name: '', type: 'ชุมนุม', advisor: '',
    description: '', members: [], createdAt: Date.now(),
  });

  const save = async (c: Club) => {
    try {
      const clean: any = { ...c };
      if (!clean.description) delete clean.description;
      await setDoc(doc(db, 'clubs', c.id), clean);
      setEditing(null);
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const del = async (c: Club) => {
    if (!confirm(`ลบ "${c.name}"?`)) return;
    try { await deleteDoc(doc(db, 'clubs', c.id)); }
    catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <h6 style={{ margin: 0, flex: 1, fontWeight: 800, color: '#0F172A' }}>
          🎯 ชุมนุม / กิจกรรม / ลูกเสือ ({clubs.length})
        </h6>
        {/* View toggle */}
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
          <button onClick={() => setView('cards')} style={{
            padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: view === 'cards' ? 'white' : 'transparent',
            fontWeight: 800, fontSize: '0.8rem', color: view === 'cards' ? '#0F172A' : '#64748B',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            boxShadow: view === 'cards' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
          }}><Grid size={12} />การ์ดชุมนุม</button>
          <button onClick={() => setView('roster')} style={{
            padding: '6px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
            background: view === 'roster' ? 'white' : 'transparent',
            fontWeight: 800, fontSize: '0.8rem', color: view === 'roster' ? '#0F172A' : '#64748B',
            display: 'inline-flex', alignItems: 'center', gap: 4,
            boxShadow: view === 'roster' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
          }}><List size={12} />รายชื่อรวม</button>
        </div>
        <button onClick={create} style={btnPrimary}><Plus size={14} /> สร้างชุมนุมใหม่</button>
      </div>

      {view === 'roster' && (
        <AllStudentsView allRooms={allRooms} clubs={clubs} />
      )}
      {view === 'cards' && (
        <CardsView clubs={clubs} setEditing={setEditing} del={del} />
      )}

      {editing && <Editor item={editing} allRooms={allRooms} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
function CardsView({ clubs, setEditing, del }: {
  clubs: Club[]; setEditing: (c: Club) => void; del: (c: Club) => Promise<void>;
}) {
  return (
    <>

      {clubs.length === 0 ? (
        <div style={{ background: 'white', padding: '3rem', textAlign: 'center', color: '#94A3B8', borderRadius: 12 }}>
          ยังไม่มีชุมนุม — กดปุ่ม "สร้างชุมนุมใหม่" เพื่อเริ่มต้น
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {clubs.map(c => (
            <div key={c.id} style={{ background: 'white', borderRadius: 12, padding: '1rem', borderLeft: `5px solid ${typeColor(c.type)}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ background: typeColor(c.type) + '22', color: typeColor(c.type), padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800 }}>{c.type}</span>
                <span style={{ background: '#FFEDD5', color: '#7C2D12', padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} />{c.members.length} คน
                </span>
              </div>
              <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0F172A' }}>{c.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: 8 }}>👨‍🏫 {c.advisor || '-'}</div>
              {c.description && <div style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 8 }}>{c.description}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditing(c)} style={btnSm}><Edit2 size={12} /> แก้ไข</button>
                <button onClick={() => del(c)} style={{ ...btnSm, color: '#DC2626', marginLeft: 'auto' }}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

    </>
  );
}

// ════════════════════════════════════════════════════════════════
// All-students view: every student in a single table with a club-assign dropdown
function AllStudentsView({ allRooms, clubs }: {
  allRooms: Array<{ id: string; label: string; students: Student[] }>;
  clubs: Club[];
}) {
  const [filterClass, setFilterClass] = useState('');
  const [filterClub, setFilterClub] = useState<'any' | 'none' | string>('any');
  const [search, setSearch] = useState('');

  // student id → list of clubs they're in
  const studentClubs = useMemo(() => {
    const map: Record<string, Club[]> = {};
    clubs.forEach(c => {
      c.members.forEach(m => {
        if (!map[m.studentId]) map[m.studentId] = [];
        map[m.studentId].push(c);
      });
    });
    return map;
  }, [clubs]);

  // Flatten all students with their class label
  const allStudents = useMemo(() => {
    const out: Array<{ s: Student; classLabel: string; classId: string }> = [];
    allRooms.forEach(r => {
      r.students.forEach(s => out.push({ s, classLabel: r.label, classId: r.id }));
    });
    return out;
  }, [allRooms]);

  const filtered = allStudents.filter(({ s, classLabel }) => {
    if (filterClass && classLabel !== filterClass) return false;
    if (search && !(s.name.includes(search) || (s.code || '').includes(search))) return false;
    if (filterClub === 'none') return (studentClubs[s.id] || []).length === 0;
    if (filterClub !== 'any' && filterClub) return (studentClubs[s.id] || []).some(c => c.id === filterClub);
    return true;
  });

  const addToClub = async (student: Student, classLabel: string, clubId: string) => {
    const club = clubs.find(c => c.id === clubId);
    if (!club) return;
    if (club.members.find(m => m.studentId === student.id)) {
      alert('นักเรียนคนนี้อยู่ในชุมนุมนี้แล้ว');
      return;
    }
    const newMember: ClubMember = {
      studentId: student.id, code: student.code || student.id,
      name: student.name, classLabel,
    };
    try {
      await setDoc(doc(db, 'clubs', club.id), {
        ...club, members: [...club.members, newMember],
      });
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  const removeFromClub = async (student: Student, club: Club) => {
    if (!confirm(`เอา ${student.name} ออกจาก "${club.name}"?`)) return;
    try {
      await setDoc(doc(db, 'clubs', club.id), {
        ...club, members: club.members.filter(m => m.studentId !== student.id),
      });
    } catch (e: any) { alert('❌ ' + (e?.message || e)); }
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, background: 'white', padding: '10px 12px', borderRadius: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ/รหัส"
          style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }} />
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <option value="">— ทุกชั้น —</option>
          {allRooms.map(r => <option key={r.id} value={r.label}>{r.label} ({r.students.length})</option>)}
        </select>
        <select value={filterClub} onChange={e => setFilterClub(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <option value="any">— ทุกสถานะ —</option>
          <option value="none">⚠️ ยังไม่อยู่ชุมนุมใด</option>
          {clubs.map(c => <option key={c.id} value={c.id}>อยู่ใน: {c.name}</option>)}
        </select>
      </div>

      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 8 }}>
        แสดง <b>{filtered.length}</b> / {allStudents.length} คน
      </div>

      <div style={{ background: 'white', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead style={{ position: 'sticky', top: 0 }}>
              <tr style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white' }}>
                <th style={th}>#</th>
                <th style={th}>ชั้น</th>
                <th style={th}>รหัส</th>
                <th style={{ ...th, textAlign: 'left', minWidth: 200 }}>ชื่อ-สกุล</th>
                <th style={th}>ชุมนุมที่อยู่</th>
                <th style={th}>เพิ่มชุมนุม</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ s, classLabel, classId: _ }, i) => {
                const myClubs = studentClubs[s.id] || [];
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #FFF7ED', background: i % 2 ? 'white' : '#FFFBF5' }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>
                      <span style={{ background: '#FFEDD5', color: '#7C2D12', padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700 }}>{classLabel}</span>
                    </td>
                    <td style={{ ...td, fontSize: '0.78rem', color: '#64748B' }}>{s.code}</td>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{s.emoji} {s.name}</td>
                    <td style={td}>
                      {myClubs.length === 0 ? (
                        <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                          {myClubs.map(c => (
                            <span key={c.id} style={{
                              background: typeColor(c.type) + '22', color: typeColor(c.type),
                              padding: '2px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}>
                              {c.name}
                              <button onClick={() => removeFromClub(s, c)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
                                title="เอาออก">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={td}>
                      <select value="" onChange={e => { if (e.target.value) addToClub(s, classLabel, e.target.value); e.target.value = ''; }}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                        <option value="">+ เพิ่ม...</option>
                        {clubs
                          .filter(c => !myClubs.find(mc => mc.id === c.id))
                          .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#94A3B8', padding: '8px 12px', background: '#FFF7ED', borderRadius: 8 }}>
        💡 คลิก dropdown "+ เพิ่ม..." ท้ายแถวเพื่อเพิ่มนักเรียนคนนั้นเข้าชุมนุม · กด <b>×</b> ในป้ายชุมนุมเพื่อเอาออก
      </div>
    </div>
  );
}

function Editor({ item, allRooms, onSave, onCancel }: {
  item: Club; allRooms: Array<{ id: string; label: string; students: Student[] }>;
  onSave: (c: Club) => void; onCancel: () => void;
}) {
  const [c, setC] = useState(item);
  const [memberSearch, setMemberSearch] = useState('');

  const memberSet = new Set(c.members.map(m => m.studentId));

  const toggleMember = (s: Student, classLabel: string) => {
    if (memberSet.has(s.id)) {
      setC({ ...c, members: c.members.filter(m => m.studentId !== s.id) });
    } else {
      setC({
        ...c, members: [...c.members, {
          studentId: s.id, code: s.code || s.id, name: s.name, classLabel,
        }],
      });
    }
  };

  const addAllFromClass = (room: typeof allRooms[number]) => {
    const additions: ClubMember[] = [];
    room.students.forEach(s => {
      if (!memberSet.has(s.id)) {
        additions.push({ studentId: s.id, code: s.code || s.id, name: s.name, classLabel: room.label });
      }
    });
    if (additions.length === 0) { alert('ทุกคนในชั้นนี้เป็นสมาชิกอยู่แล้ว'); return; }
    setC({ ...c, members: [...c.members, ...additions] });
  };

  const removeAllFromClass = (room: typeof allRooms[number]) => {
    setC({ ...c, members: c.members.filter(m => m.classLabel !== room.label) });
  };

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, maxWidth: 900, width: '100%', maxHeight: '92vh', overflow: 'auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h5 style={{ margin: 0, fontWeight: 900, flex: 1 }}>✏️ {c.id.startsWith('club_') ? 'สร้าง' : 'แก้ไข'}ชุมนุม</h5>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl}>ชื่อชุมนุม/กิจกรรม *</label>
            <input value={c.name} onChange={e => setC({ ...c, name: e.target.value })}
              placeholder="เช่น ชุมนุมหมากรุก" style={inp} />
          </div>
          <div>
            <label style={lbl}>ประเภท</label>
            <select value={c.type} onChange={e => setC({ ...c, type: e.target.value as ClubType })} style={inp}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>ครูที่ปรึกษา *</label>
            <input value={c.advisor} onChange={e => setC({ ...c, advisor: e.target.value })}
              placeholder="ชื่อ-สกุลครู" style={inp} />
          </div>
          <div>
            <label style={lbl}>คำอธิบาย</label>
            <input value={c.description || ''} onChange={e => setC({ ...c, description: e.target.value })} style={inp} />
          </div>
        </div>

        {/* Members section */}
        <div style={{ background: '#FFF7ED', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: '#7C2D12' }}>
              👥 สมาชิก ({c.members.length} คน)
            </span>
            <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
              placeholder="ค้นหานักเรียน..." style={{ ...inp, flex: 1, minWidth: 150, fontSize: '0.85rem' }} />
          </div>

          {/* Selected members */}
          {c.members.length > 0 && (
            <div style={{ marginBottom: 10, padding: 8, background: 'white', borderRadius: 8, maxHeight: 100, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>✅ สมาชิกที่เลือกแล้ว:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {c.members.map(m => (
                  <span key={m.studentId} style={{
                    background: '#FFEDD5', color: '#7C2D12', padding: '2px 8px',
                    borderRadius: 999, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    {m.name} <span style={{ color: '#94A3B8', fontSize: '0.65rem' }}>{m.classLabel}</span>
                    <button onClick={() => setC({ ...c, members: c.members.filter(x => x.studentId !== m.studentId) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#DC2626' }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Class selector */}
          {allRooms.map(room => {
            const filtered = room.students.filter(s =>
              !memberSearch || s.name.includes(memberSearch) || (s.code || '').includes(memberSearch)
            );
            if (filtered.length === 0) return null;
            const inThisClub = room.students.filter(s => memberSet.has(s.id)).length;
            return (
              <details key={room.id} style={{ marginBottom: 6, background: 'white', borderRadius: 8, padding: '6px 10px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1 }}>{room.label} ({inThisClub}/{room.students.length} คน)</span>
                  <button onClick={(e) => { e.preventDefault(); addAllFromClass(room); }}
                    style={{ ...btnSm, background: '#10B981', color: 'white', fontSize: '0.7rem' }}>
                    <UserPlus size={10} />ทั้งห้อง
                  </button>
                  {inThisClub > 0 && (
                    <button onClick={(e) => { e.preventDefault(); removeAllFromClass(room); }}
                      style={{ ...btnSm, background: '#FEE2E2', color: '#991B1B', fontSize: '0.7rem' }}>
                      ลบทั้งห้อง
                    </button>
                  )}
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 4, marginTop: 8 }}>
                  {filtered.map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6,
                      background: memberSet.has(s.id) ? '#DCFCE7' : '#F8FAFC', cursor: 'pointer', fontSize: '0.78rem' }}>
                      <input type="checkbox" checked={memberSet.has(s.id)}
                        onChange={() => toggleMember(s, room.label)} />
                      <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>{s.code}</span>
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>ยกเลิก</button>
          <button onClick={() => onSave(c)} disabled={!c.name || !c.advisor}
            style={{ ...btnPrimary, opacity: (!c.name || !c.advisor) ? 0.4 : 1 }}>
            <Save size={14} /> บันทึก ({c.members.length} สมาชิก)
          </button>
        </div>
      </div>
    </div>
  );
}

const typeColor = (t: ClubType) => ({
  'ชุมนุม': '#3B82F6',
  'ลูกเสือ-เนตรนารี': '#10B981',
  'กิจกรรมพัฒนาผู้เรียน': '#A855F7',
  'อื่น ๆ': '#64748B',
}[t] || '#64748B');

const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' };
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 };
const btnPrimary: React.CSSProperties = { background: '#FF6A01', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnSecondary: React.CSSProperties = { background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' };
const btnSm: React.CSSProperties = { background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#475569' };
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 800, fontSize: '0.78rem', textAlign: 'center', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 10px', textAlign: 'center' };
