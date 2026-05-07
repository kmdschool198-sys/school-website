import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { Printer, Save, AlertTriangle, X, Users, BookOpen, Calendar as Cal, Coffee, UserPlus, Download, Upload, RotateCcw } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Teacher { id: string; prefix?: string; first: string; last: string; dept?: string; rank?: string; subjects?: string[]; }
interface Subject { id: string; name: string; code?: string; dept?: string; hours?: number; color?: string; }
interface Room    { id: string; level?: string; grade: string; room?: string; homeroom?: string; label: string; }
interface Slot    { id: number; label: string; start: string; end: string; }
interface SchedCell { subject?: string; teacher?: string; substitute?: string; free?: boolean; }
interface School  { name: string; year?: string; semester?: string; principalName?: string; principalPos?: string; acadName?: string; acadPos?: string; }
interface TTData  { school: School; teachers: Teacher[]; subjects: Subject[]; rooms: Room[]; slots: Slot[]; days: string[]; sched: Record<string, SchedCell>; substitute?: Record<string, any>; }

// ─── Helpers ────────────────────────────────────────────────────────────────
const seedData = (): TTData => {
  const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
  return profile.data as TTData;
};
const SEP = '_';
const cellKey = (roomId: string, slot: number, day: string) => `${roomId}${SEP}${slot}${SEP}${day}`;
// Robust parser: slot is numeric & day is Thai (no _), so split off the last 2 segments
const parseKey = (key: string): [string, string, string] => {
  const parts = key.split('_');
  const day = parts.pop()!;
  const slot = parts.pop()!;
  return [parts.join('_'), slot, day];
};
const teacherName = (t?: Teacher) => t ? `${t.prefix || ''}${t.first} ${t.last}`.trim() : '';
const colorFor = (subjectName: string, subjects: Subject[]) =>
  subjects.find(s => s.name === subjectName)?.color || '#F1F5F9';
const FREE_LABEL = 'คาบว่าง';

// ─── Main component ─────────────────────────────────────────────────────────
type View = 'class' | 'teacher' | 'overview' | 'sub' | 'data';

export default function TimetableSmart({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<TTData>(() => seedData());
  const [view, setView] = useState<View>('class');
  const [activeRoom, setActiveRoom] = useState<string>('');
  const [activeTeacher, setActiveTeacher] = useState<string>(''); // teacher NAME
  const [editing, setEditing] = useState<{ roomId: string; slot: number; day: string } | null>(null);
  const [search, setSearch] = useState('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Cloud sync
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'timetable'), snap => {
      if (snap.exists()) {
        const d = snap.data() as TTData;
        if (d.rooms?.length) setData(d);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeRoom && data.rooms.length) setActiveRoom(data.rooms[0].id);
    if (!activeTeacher && data.teachers.length) setActiveTeacher(teacherName(data.teachers[0]));
  }, [data.rooms, data.teachers]);

  const saveToCloud = async () => {
    if (readOnly) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'config', 'timetable'), data);
      setSavedAt(new Date());
    } catch (e: any) {
      alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        // Accept either raw TTData OR full backup format with profiles{}
        const d: TTData = parsed.profiles
          ? parsed.profiles[Object.keys(parsed.profiles)[0]].data
          : parsed;
        if (!d.rooms || !d.teachers) throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง');
        if (!confirm(`โหลดข้อมูลจากไฟล์? (${d.rooms.length} ห้อง, ${d.teachers.length} ครู — ของเดิมจะถูกแทนที่)`)) return;
        setData(d);
      } catch (e: any) {
        alert('❌ อ่านไฟล์ไม่สำเร็จ: ' + (e?.message || e));
      }
    };
    reader.readAsText(file);
  };

  const resetToSeed = () => {
    if (!confirm('รีเซ็ตเป็นข้อมูลเริ่มต้น? (ของเดิมจะหาย — ควร Export ก่อน)')) return;
    setData(seedData());
  };

  const updateCell = (key: string, val: SchedCell | null) => {
    setData(d => {
      const sched = { ...d.sched };
      if (!val || (!val.subject && !val.teacher && !val.substitute && !val.free)) delete sched[key];
      else sched[key] = val;
      return { ...d, sched };
    });
  };

  // ─── Conflict detection: same teacher (name) at same slot/day ────────────
  const { conflictCells, conflictGroups } = useMemo(() => {
    const map: Record<string, { rooms: string[]; slot: string; day: string }> = {};
    Object.entries(data.sched).forEach(([key, cell]) => {
      const t = cell.substitute || cell.teacher;
      if (!t || cell.free) return;
      const [roomId, slot, day] = parseKey(key);
      const k = `${t}${SEP}${slot}${SEP}${day}`;
      if (!map[k]) map[k] = { rooms: [], slot, day };
      map[k].rooms.push(roomId);
    });
    const cells = new Set<string>();
    let groups = 0;
    Object.values(map).forEach(({ rooms, slot, day }) => {
      if (rooms.length > 1) {
        groups++;
        rooms.forEach(r => cells.add(cellKey(r, +slot, day)));
      }
    });
    return { conflictCells: cells, conflictGroups: groups };
  }, [data.sched]);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalCells = data.rooms.length * data.slots.length * data.days.length;
    const cells = Object.values(data.sched);
    const filled = cells.filter(c => c.subject || c.teacher || c.free).length;
    const free = cells.filter(c => c.free).length;
    const subs = cells.filter(c => c.substitute).length;
    return {
      teachers: data.teachers.length,
      subjects: data.subjects.length,
      rooms: data.rooms.length,
      filled, totalCells, free, subs,
      pct: totalCells ? Math.round((filled / totalCells) * 100) : 0,
      conflicts: conflictGroups,
    };
  }, [data, conflictGroups]);

  // ─── Class grid ─────────────────────────────────────────────────────────
  const renderClassGrid = () => {
    const room = data.rooms.find(r => r.id === activeRoom);
    if (!room) return <div className="text-muted">เลือกห้องเรียนก่อน</div>;
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={th}>คาบ / วัน</th>
              {data.days.map(d => <th key={d} style={th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.slots.map(slot => (
              <tr key={slot.id}>
                <td style={{ ...td, background: '#FFF7ED', fontWeight: 800, color: '#7C2D12' }}>
                  <div style={{ fontSize: '0.85rem' }}>{slot.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{slot.start}-{slot.end}</div>
                </td>
                {data.days.map(day => {
                  const k = cellKey(room.id, slot.id, day);
                  const cell = data.sched[k];
                  const conflict = conflictCells.has(k);
                  return (
                    <td key={day} style={{
                      ...td, padding: 6,
                      background: cell?.free ? '#F1F5F9'
                        : cell?.subject ? colorFor(cell.subject, data.subjects)
                        : 'white',
                      cursor: readOnly ? 'default' : 'pointer', position: 'relative',
                      border: conflict ? '2px solid #EF4444' : '1px solid #FFEDD5',
                      opacity: cell?.free ? 0.7 : 1,
                    }}
                    onClick={() => !readOnly && setEditing({ roomId: room.id, slot: slot.id, day })}>
                      {cell?.free && (
                        <div style={{ fontWeight: 800, color: '#64748B', fontSize: '0.85rem' }}>☕ {FREE_LABEL}</div>
                      )}
                      {!cell?.free && cell?.subject && (
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{cell.subject}</div>
                      )}
                      {!cell?.free && cell?.teacher && (
                        <div style={{ fontSize: '0.72rem', color: cell.substitute ? '#94A3B8' : '#475569', marginTop: 2, textDecoration: cell.substitute ? 'line-through' : 'none' }}>
                          {cell.teacher}
                        </div>
                      )}
                      {cell?.substitute && (
                        <div style={{ fontSize: '0.72rem', color: '#7C3AED', marginTop: 2, fontWeight: 700 }}>
                          🔁 สอนแทน: {cell.substitute}
                        </div>
                      )}
                      {conflict && (
                        <span style={{ position: 'absolute', top: 2, right: 2, color: '#EF4444' }} title="ครูซ้ำคาบ">
                          <AlertTriangle size={12} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── Teacher grid ───────────────────────────────────────────────────────
  const renderTeacherGrid = () => {
    if (!activeTeacher) return <div className="text-muted">เลือกครูก่อน</div>;
    type Mark = 'main' | 'sub' | 'covered';
    const tSched: Record<string, { room: Room; cell: SchedCell; mark: Mark }> = {};
    Object.entries(data.sched).forEach(([key, cell]) => {
      if (cell.free) return;
      let mark: Mark | null = null;
      if (cell.substitute === activeTeacher) mark = 'sub';
      else if (cell.teacher === activeTeacher && !cell.substitute) mark = 'main';
      else if (cell.teacher === activeTeacher && cell.substitute) mark = 'covered';
      if (!mark) return;
      const [roomId, slot, day] = parseKey(key);
      const room = data.rooms.find(r => r.id === roomId);
      if (room) tSched[`${slot}${SEP}${day}`] = { room, cell, mark };
    });
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={th}>คาบ / วัน</th>
              {data.days.map(d => <th key={d} style={th}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.slots.map(slot => (
              <tr key={slot.id}>
                <td style={{ ...td, background: '#FFF7ED', fontWeight: 800, color: '#7C2D12' }}>
                  <div style={{ fontSize: '0.85rem' }}>{slot.label}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{slot.start}-{slot.end}</div>
                </td>
                {data.days.map(day => {
                  const entry = tSched[`${slot.id}${SEP}${day}`];
                  const covered = entry?.mark === 'covered';
                  return (
                    <td key={day} style={{
                      ...td,
                      background: !entry ? 'white'
                        : covered ? '#FEF3C7'
                        : colorFor(entry.cell.subject || '', data.subjects),
                      borderLeft: entry?.mark === 'sub' ? '4px solid #7C3AED'
                        : entry?.mark === 'covered' ? '4px solid #F59E0B' : undefined,
                      opacity: covered ? 0.75 : 1,
                    }}>
                      {entry && (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A', textDecoration: covered ? 'line-through' : 'none' }}>{entry.cell.subject}</div>
                          <div style={{ fontSize: '0.72rem', color: '#475569' }}>{entry.room.label}</div>
                          {entry.mark === 'sub' && <div style={{ fontSize: '0.7rem', color: '#7C3AED', fontWeight: 700, marginTop: 2 }}>🔁 สอนแทน</div>}
                          {entry.mark === 'covered' && <div style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 700, marginTop: 2 }}>⚠ ขาด · {entry.cell.substitute} สอนแทน</div>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── Workload (by teacher NAME) ─────────────────────────────────────────
  const renderOverview = () => {
    const load: Record<string, { main: number; sub: number }> = {};
    Object.values(data.sched).forEach(c => {
      if (c.free) return;
      const mainName = c.substitute ? null : c.teacher;
      if (mainName) (load[mainName] = load[mainName] || { main: 0, sub: 0 }).main++;
      if (c.substitute) (load[c.substitute] = load[c.substitute] || { main: 0, sub: 0 }).sub++;
    });
    const filtered = data.teachers.filter(t =>
      !search || `${t.first} ${t.last} ${t.dept || ''}`.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {filtered.map(t => {
          const name = teacherName(t);
          const l = load[name] || { main: 0, sub: 0 };
          const total = l.main + l.sub;
          return (
            <div key={t.id} style={{
              background: 'white', padding: '1rem', borderRadius: 14,
              border: '1px solid #FFEDD5', borderLeft: `4px solid ${total > 25 ? '#EF4444' : total > 18 ? '#F59E0B' : '#10B981'}`,
            }}>
              <div style={{ fontWeight: 800, color: '#0F172A' }}>{name}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: 8 }}>{t.rank} · {t.dept}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>คาบสอน/สัปดาห์</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: total > 25 ? '#EF4444' : '#0F172A' }}>{total}</span>
              </div>
              {l.sub > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#7C3AED', fontWeight: 700, marginTop: 4 }}>
                  รวมสอนแทน {l.sub} คาบ
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Substitute teaching log ────────────────────────────────────────────
  const renderSubPanel = () => {
    const dayOrder = data.days;
    const subs: any[] = Object.entries(data.sched)
      .filter(([, c]) => c.substitute)
      .map(([key, c]) => {
        const [roomId, slot, day] = parseKey(key);
        return {
          key, slot: +slot, day, dateStr: 'ตารางสอนปกติ',
          room: data.rooms.find(r => r.id === roomId),
          slotInfo: data.slots.find(s => s.id === +slot),
          subject: c.subject || '-',
          original: c.teacher || '-',
          substitute: c.substitute!,
        };
      });

    // Add daily substitutes from timetable.html
    if (data.substitute) {
      Object.entries(data.substitute).forEach(([dateStr, dailyData]: [string, any]) => {
        if (dailyData && dailyData.absentList) {
          dailyData.absentList.forEach((absent: any) => {
            const origTeacher = data.teachers.find(t => t.id === absent.teacherId);
            absent.periods.forEach((p: any) => {
              if (p.subTeacher) {
                subs.push({
                  key: `daily_${dateStr}_${absent.teacherId}_${p.slotId}`,
                  slot: p.slotId,
                  day: p.day || dayOrder[new Date(dateStr).getDay() - 1] || '-',
                  dateStr: dateStr,
                  room: data.rooms.find(r => r.id === p.roomId),
                  slotInfo: data.slots.find(s => s.id === p.slotId),
                  subject: p.subject || '-',
                  original: teacherName(origTeacher) || '-',
                  substitute: p.subTeacher,
                });
              }
            });
          });
        }
      });
    }

    subs.sort((a, b) => {
      if (a.dateStr !== b.dateStr && a.dateStr !== 'ตารางสอนปกติ' && b.dateStr !== 'ตารางสอนปกติ') {
         return b.dateStr.localeCompare(a.dateStr);
      }
      if (a.dateStr !== b.dateStr) return a.dateStr === 'ตารางสอนปกติ' ? 1 : -1;
      const di = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (di !== 0) return di;
      return a.slot - b.slot;
    });

    // Aggregate per substitute teacher
    const bySubTeacher: Record<string, number> = {};
    subs.forEach(s => { bySubTeacher[s.substitute] = (bySubTeacher[s.substitute] || 0) + 1; });
    const topSubs = Object.entries(bySubTeacher).sort(([, a], [, b]) => b - a);

    if (subs.length === 0) {
      return (
        <div style={{ background: 'white', padding: '2rem', borderRadius: 14, textAlign: 'center', color: '#94A3B8', border: '2px dashed #E2E8F0' }}>
          <UserPlus size={36} style={{ marginBottom: 10, opacity: 0.5 }} />
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>ยังไม่มีรายการสอนแทน</div>
          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>เพิ่มการสอนแทนในตารางรายวัน หรือคลิก cell ในตาราง → "เพิ่มครูสอนแทน"</div>
        </div>
      );
    }

    return (
      <div>
        {/* Top substitute teachers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 16 }}>
          {topSubs.map(([name, count]) => (
            <div key={name} style={{
              background: 'linear-gradient(135deg,#7C3AED,#A855F7)', color: 'white',
              padding: '12px 14px', borderRadius: 12,
            }}>
              <div style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 700 }}>🔁 ครูสอนแทน</div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', marginTop: 2 }}>{name}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, marginTop: 4 }}>{count} <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700 }}>คาบ</span></div>
            </div>
          ))}
        </div>

        {/* Detail table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 800 }}>
            <thead>
              <tr>
                <th style={th}>วันที่/ประเภท</th>
                <th style={th}>วัน</th>
                <th style={th}>คาบ</th>
                <th style={th}>เวลา</th>
                <th style={th}>ห้อง</th>
                <th style={th}>วิชา</th>
                <th style={th}>ครูเจ้าของ</th>
                <th style={th}>ครูสอนแทน</th>
                {!readOnly && <th style={th}></th>}
              </tr>
            </thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.key}>
                  <td style={{ ...td, fontWeight: 700, color: s.dateStr === 'ตารางสอนปกติ' ? '#64748B' : '#0F172A', background: '#F8FAFC' }}>
                    {s.dateStr === 'ตารางสอนปกติ' ? '📌 สอนแทนประจำ' : `📅 ${s.dateStr}`}
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: '#7C2D12', background: '#FFF7ED' }}>{s.day}</td>
                  <td style={td}>{s.slotInfo?.label || s.slot}</td>
                  <td style={{ ...td, fontSize: '0.78rem', color: '#64748B' }}>{s.slotInfo ? `${s.slotInfo.start}-${s.slotInfo.end}` : '-'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{s.room?.label || '-'}</td>
                  <td style={td}>{s.subject}</td>
                  <td style={{ ...td, color: '#94A3B8', textDecoration: 'line-through' }}>{s.original}</td>
                  <td style={{ ...td, color: '#7C3AED', fontWeight: 800 }}>🔁 {s.substitute}</td>
                  {!readOnly && (
                    <td style={td}>
                      {s.dateStr === 'ตารางสอนปกติ' && (
                        <button onClick={() => {
                          if (!confirm(`ยกเลิกการสอนแทนประจำของ ${s.substitute}?`)) return;
                          const cell = data.sched[s.key];
                          if(cell) updateCell(s.key, { ...cell, substitute: undefined });
                        }}
                          style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #FECACA', background: 'white', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                          ยกเลิก
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderDataPanel = () => (
    <div className="row g-3">
      <div className="col-md-6">
        <h6 className="fw-bold mb-2">📚 รายวิชา ({data.subjects.length})</h6>
        <div style={{ maxHeight: 400, overflow: 'auto', background: 'white', borderRadius: 10, border: '1px solid #FFEDD5' }}>
          {data.subjects.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #FFF7ED' }}>
              <span style={{ width: 14, height: 14, background: s.color || '#E2E8F0', borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.name}</div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{s.dept} · {s.hours} คาบ/สัปดาห์</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="col-md-6">
        <h6 className="fw-bold mb-2">👥 ครู ({data.teachers.length})</h6>
        <div style={{ maxHeight: 400, overflow: 'auto', background: 'white', borderRadius: 10, border: '1px solid #FFEDD5' }}>
          {data.teachers.map(t => (
            <div key={t.id} style={{ padding: '8px 12px', borderBottom: '1px solid #FFF7ED' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{teacherName(t)}</div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{t.dept} · {t.subjects?.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const printTitle = view === 'class'
    ? `ตารางเรียน · ${data.rooms.find(r => r.id === activeRoom)?.label || ''}`
    : view === 'teacher' ? `ตารางสอน · ${activeTeacher}`
    : view === 'overview' ? 'ภาระงานครู'
    : 'ข้อมูล';

  const renderBody = () => (
    <>
      <div className="tt-print-header">
        <h3>{data.school.name}</h3>
        <div className="sub">{printTitle} · ปีการศึกษา {data.school.year} ภาคเรียนที่ {data.school.semester}</div>
      </div>
      <div className="tt-grid">
        {view === 'class' && renderClassGrid()}
        {view === 'teacher' && renderTeacherGrid()}
        {view === 'overview' && renderOverview()}
        {view === 'sub' && renderSubPanel()}
        {view === 'data' && renderDataPanel()}
      </div>
    </>
  );

  return (
    <div className="tt-root" style={{ background: '#FFF7ED', borderRadius: 18, padding: '1.25rem' }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body > *:not(.tt-print-portal):not(script):not(style) { display: none !important; }
          body .tt-print-portal { display: block !important; position: static !important; width: 100% !important; background: white !important; padding: 0 !important; margin: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          .tt-print-portal .tt-no-print { display: none !important; }
          .tt-print-portal .tt-print-header { display: block !important; margin-bottom: 8px; text-align: center; }
          .tt-print-portal .tt-print-header h3 { margin: 0; font-size: 16pt; font-weight: 900; }
          .tt-print-portal .tt-print-header .sub { font-size: 10pt; color: #475569; }
          .tt-print-portal .tt-grid { overflow: visible !important; }
          .tt-print-portal .tt-grid table { width: 100% !important; font-size: 9pt !important; page-break-inside: auto; border-collapse: collapse !important; min-width: 0 !important; }
          .tt-print-portal .tt-grid tr { page-break-inside: avoid; }
          .tt-print-portal .tt-grid th, .tt-print-portal .tt-grid td { padding: 4px 6px !important; border: 1px solid #94A3B8 !important; }
          .tt-print-portal .tt-grid th { background: #1E3A8A !important; color: white !important; }
        }
        .tt-print-header { display: none; }
      `}</style>

      {/* Top bar */}
      <div className="tt-no-print" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '1.1rem' }}>{data.school.name}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748B' }}>ปีการศึกษา {data.school.year} · ภาคเรียนที่ {data.school.semester}</div>
        </div>
        {savedAt && <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>✓ บันทึก {savedAt.toLocaleTimeString('th-TH')}</span>}
        {!readOnly && (
          <button onClick={saveToCloud} disabled={loading}
            style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}>
            <Save size={14} style={{ marginRight: 6 }} />{loading ? 'กำลังบันทึก…' : 'บันทึกขึ้นคลาวด์'}
          </button>
        )}
        <button onClick={() => window.print()}
          style={{ background: 'white', border: '1px solid #FFEDD5', color: '#7C2D12', padding: '8px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
          <Printer size={14} style={{ marginRight: 6 }} />พิมพ์
        </button>
      </div>

      {/* Admin toolbar (export/import/reset) */}
      {!readOnly && (
        <div className="tt-no-print" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', padding: '10px 12px', background: 'white', borderRadius: 12, border: '1px dashed #FFD7B0' }}>
          <button onClick={exportJson}
            style={{ background: '#10B981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} />Export JSON
          </button>
          <label style={{ background: '#3B82F6', color: 'white', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Upload size={12} />Import JSON
            <input type="file" accept=".json,application/json" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
          </label>
          <button onClick={resetToSeed}
            style={{ background: 'white', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={12} />รีเซ็ตเป็นข้อมูลเริ่มต้น
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94A3B8', alignSelf: 'center' }}>
            💡 แนะนำ Export ก่อนแก้ไขทุกครั้ง
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="tt-no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'ครู', v: stats.teachers, c: '#3B82F6' },
          { label: 'วิชา', v: stats.subjects, c: '#10B981' },
          { label: 'ห้องเรียน', v: stats.rooms, c: '#F59E0B' },
          { label: 'คาบที่กรอก', v: `${stats.filled}/${stats.totalCells}`, c: '#FF6A01' },
          { label: 'ความสมบูรณ์', v: `${stats.pct}%`, c: '#A855F7' },
          { label: 'คาบว่าง', v: stats.free, c: '#64748B' },
          { label: 'สอนแทน', v: stats.subs, c: '#7C3AED' },
          { label: 'ครูซ้ำคาบ', v: stats.conflicts, c: stats.conflicts > 0 ? '#EF4444' : '#10B981' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', padding: 10, borderRadius: 10, borderTop: `3px solid ${s.c}` }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* View tabs */}
      <div className="tt-no-print" style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          ['class', <Cal size={14} />, 'ตารางเรียน'],
          ['teacher', <Users size={14} />, 'ตารางสอน (รายครู)'],
          ['sub', <UserPlus size={14} />, 'สอนแทน'],
          ['data', <BookOpen size={14} />, 'ข้อมูล'],
        ].map(([k, ic, l]: any) => (
          <button key={k} onClick={() => setView(k)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: '0.85rem',
              background: view === k ? 'linear-gradient(135deg,#FF6A01,#FB923C)' : 'white',
              color: view === k ? 'white' : '#475569', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>{ic}{l}</button>
        ))}
      </div>

      {/* Filters */}
      {view === 'class' && (
        <select value={activeRoom} onChange={e => setActiveRoom(e.target.value)}
          style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid #FFEDD5', fontWeight: 700 }}>
          {data.rooms.map(r => <option key={r.id} value={r.id}>{r.label} {r.homeroom ? `· ${r.homeroom}` : ''}</option>)}
        </select>
      )}
      {view === 'teacher' && (
        <select value={activeTeacher} onChange={e => setActiveTeacher(e.target.value)}
          style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid #FFEDD5', fontWeight: 700 }}>
          {data.teachers.map(t => {
            const n = teacherName(t);
            return <option key={t.id} value={n}>{n}</option>;
          })}
        </select>
      )}
      {view === 'overview' && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาครู..."
          style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, border: '1px solid #FFEDD5', width: '100%', maxWidth: 300 }} />
      )}

      {/* Body */}
      <div className="tt-grid">
        {view === 'class' && renderClassGrid()}
        {view === 'teacher' && renderTeacherGrid()}
        {view === 'overview' && renderOverview()}
        {view === 'sub' && renderSubPanel()}
        {view === 'data' && renderDataPanel()}
      </div>

      {/* Print portal — hidden on screen, only visible in print */}
      {createPortal(
        <div className="tt-print-portal" style={{ display: 'none' }}>{renderBody()}</div>,
        document.body
      )}

      {/* Edit modal */}
      {editing && (
        <CellEditor
          data={data}
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={(val) => { updateCell(cellKey(editing.roomId, editing.slot, editing.day), val); setEditing(null); }}
          currentCell={data.sched[cellKey(editing.roomId, editing.slot, editing.day)]}
        />
      )}
    </div>
  );
}

// ─── Cell editor ────────────────────────────────────────────────────────────
function CellEditor({ data, editing, onClose, onSave, currentCell }: {
  data: TTData;
  editing: { roomId: string; slot: number; day: string };
  onClose: () => void;
  onSave: (v: SchedCell | null) => void;
  currentCell?: SchedCell;
}) {
  // useEffect imported at top — used below for Esc-to-close
  const [subject, setSubject] = useState(currentCell?.subject || '');
  const [teacher, setTeacher] = useState(currentCell?.teacher || '');
  const [substitute, setSubstitute] = useState(currentCell?.substitute || '');
  const [free, setFree] = useState(!!currentCell?.free);
  const room = data.rooms.find(r => r.id === editing.roomId);
  const slot = data.slots.find(s => s.id === editing.slot);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const teacherNames = useMemo(() => data.teachers.map(teacherName), [data.teachers]);
  const suggestedTeachers = useMemo(() => {
    if (!subject) return teacherNames;
    const tagged = data.teachers.filter(t => t.subjects?.includes(subject)).map(teacherName);
    return tagged.length ? tagged : teacherNames;
  }, [subject, data.teachers, teacherNames]);

  const submit = () => {
    if (free) {
      onSave({ free: true });
    } else {
      onSave({ subject, teacher, substitute: substitute || undefined });
      if (substitute && substitute !== currentCell?.substitute) {
        alert(`✅ มอบหมายให้ ${substitute} สอนแทน ${teacher} ในคาบนี้เรียบร้อยแล้ว!`);
      }
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 18, padding: '1.5rem',
        maxWidth: 480, width: '100%', boxShadow: '0 30px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h5 style={{ margin: 0, fontWeight: 900 }}>กำหนดวิชา</h5>
            <div style={{ fontSize: '0.85rem', color: '#64748B' }}>{room?.label} · {slot?.label} · {editing.day}</div>
          </div>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => { setFree(!free); }}
            style={{ padding: '8px 12px', borderRadius: 10, border: free ? 'none' : '1px solid #CBD5E1', background: free ? '#64748B' : 'white', color: free ? 'white' : '#475569', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Coffee size={12} />{free ? '✓ คาบว่าง' : 'ทำเป็นคาบว่าง'}
          </button>
          {!free && teacher && (
            <button onClick={() => setSubstitute(substitute ? '' : teacher)}
              style={{ padding: '8px 12px', borderRadius: 10, border: substitute ? 'none' : '1px solid #DDD6FE', background: substitute ? '#7C3AED' : 'white', color: substitute ? 'white' : '#7C3AED', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <UserPlus size={12} />{substitute ? '✓ มีครูสอนแทน' : 'เพิ่มครูสอนแทน'}
            </button>
          )}
        </div>

        {!free && (
          <>
            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>วิชา</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 12 }}>
              <option value="">— ไม่กำหนด —</option>
              {data.subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>

            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>
              ครูประจำวิชา {subject && suggestedTeachers.length < teacherNames.length && (
                <span style={{ fontSize: '0.72rem', color: '#10B981' }}>· แนะนำตามวิชา</span>
              )}
            </label>
            <select value={teacher} onChange={e => setTeacher(e.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 12 }}>
              <option value="">— ไม่กำหนด —</option>
              {suggestedTeachers.map(n => <option key={n} value={n}>{n}</option>)}
              {subject && suggestedTeachers.length < teacherNames.length && (
                <optgroup label="ครูอื่น ๆ">
                  {teacherNames.filter(n => !suggestedTeachers.includes(n)).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </optgroup>
              )}
            </select>

            {substitute !== '' && (
              <>
                <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#7C3AED' }}>
                  🔁 ครูสอนแทน
                </label>
                <select value={substitute} onChange={e => setSubstitute(e.target.value)}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #DDD6FE', marginBottom: 16 }}>
                  <option value="">— เลือกครูสอนแทน —</option>
                  {teacherNames.filter(n => n !== teacher).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onSave(null)}
            style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #FECACA', background: 'white', color: '#DC2626', fontWeight: 700, cursor: 'pointer' }}>
            ลบ
          </button>
          <button onClick={submit}
            style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '10px', background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white', fontWeight: 800, fontSize: '0.85rem', borderRadius: 0 };
const td: React.CSSProperties = { padding: '10px', border: '1px solid #FFEDD5', verticalAlign: 'top', fontSize: '0.85rem', minHeight: 60 };
