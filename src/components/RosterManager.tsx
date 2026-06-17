import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, getDocs, collection, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { TIMETABLE_BACKUP } from '../data/timetableData';
import { Trash2, UserPlus, Upload, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PageLoading } from './PageState';

interface Student { id: string; code?: string; name: string; emoji?: string; }
interface ClassRoster { classId: string; label: string; students: Student[]; }

const KG_CLASSES: ClassRoster[] = [
  { classId: 'kg_a2_1', label: 'อ.2/1', students: [] },
  { classId: 'kg_a3_1', label: 'อ.3/1', students: [] },
];

const seedClasses = (): ClassRoster[] => {
  const profile = (TIMETABLE_BACKUP as any).profiles[Object.keys((TIMETABLE_BACKUP as any).profiles)[0]];
  const rooms = profile.data.rooms as Array<{ id: string; label: string }>;
  return [...KG_CLASSES, ...rooms.map(r => ({ classId: r.id, label: r.label, students: [] }))];
};

export default function RosterManager() {
  const [classes, setClasses] = useState<ClassRoster[]>(seedClasses);
  const [classId, setClassId] = useState<string>('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) {
          const cloud = new Map(d.classes.map(c => [c.classId, c]));
          setClasses(prev => {
            const merged = prev.map(c => ({ ...c, students: cloud.get(c.classId)?.students || c.students }));
            const seen = new Set(merged.map(c => c.classId));
            d.classes.forEach(c => { if (!seen.has(c.classId)) merged.push(c); });
            return merged;
          });
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].classId);
  }, [classes]);

  const current = classes.find(c => c.classId === classId);

  const save = async (next: ClassRoster[]) => {
    // 1. Identify added and removed students
    const currentStudentsMap = new Map<string, string>(); // studentId -> classId
    classes.forEach(c => c.students.forEach(s => currentStudentsMap.set(s.id, c.classId)));

    const nextStudentsMap = new Map<string, string>(); // studentId -> classId
    next.forEach(c => c.students.forEach(s => nextStudentsMap.set(s.id, c.classId)));

    const added: { id: string; classId: string }[] = [];
    next.forEach(c => {
      c.students.forEach(s => {
        if (!currentStudentsMap.has(s.id)) {
          added.push({ id: s.id, classId: c.classId });
        }
      });
    });

    const removed: { id: string; classId: string }[] = [];
    classes.forEach(c => {
      c.students.forEach(s => {
        if (!nextStudentsMap.has(s.id)) {
          removed.push({ id: s.id, classId: c.classId });
        }
      });
    });

    setClasses(next);
    setSaving(true);
    try {
      // First save the main config document
      await setDoc(doc(db, 'config', 'attendance_classes'), { classes: next });

      // If roster changes exist, sync Firestore collections
      if (added.length > 0 || removed.length > 0) {
        // Group by classId to minimize daily attendance queries
        const affectedClasses = new Set<string>();
        added.forEach(x => affectedClasses.add(x.classId));
        removed.forEach(x => affectedClasses.add(x.classId));

        for (const cid of affectedClasses) {
          const q = query(collection(db, 'attendance'), where('classId', '==', cid));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const batch = writeBatch(db);
            let updatedCount = 0;

            snap.docs.forEach(docSnap => {
              const docData = docSnap.data();
              const records = { ...(docData.records || {}) };
              let changed = false;

              // Backfill added students for this class with 'present'
              added.forEach(x => {
                if (x.classId === cid) {
                  if (!records[x.id]) {
                    records[x.id] = { status: 'present' };
                    changed = true;
                  }
                }
              });

              // Clean up removed students for this class
              removed.forEach(x => {
                if (x.classId === cid) {
                  if (records[x.id]) {
                    delete records[x.id];
                    changed = true;
                  }
                }
              });

              if (changed) {
                batch.update(docSnap.ref, { records });
                updatedCount++;
              }
            });

            if (updatedCount > 0) {
              await batch.commit();
            }
          }
        }

        // Clean up removed students from other collections
        for (const x of removed) {
          // 1. Delete body metrics records
          const bmQuery = query(collection(db, 'log_body_metrics'), where('studentId', '==', x.id));
          const bmSnap = await getDocs(bmQuery);
          if (!bmSnap.empty) {
            const bmBatch = writeBatch(db);
            bmSnap.docs.forEach(d => bmBatch.delete(d.ref));
            await bmBatch.commit();
          }

          // 2. Delete savings records
          const svQuery = query(collection(db, 'log_saving'), where('studentId', '==', x.id));
          const svSnap = await getDocs(svQuery);
          if (!svSnap.empty) {
            const svBatch = writeBatch(db);
            svSnap.docs.forEach(d => svBatch.delete(d.ref));
            await svBatch.commit();
          }

          // 3. Remove from clubs list, attendance, and evaluations
          const clubsSnap = await getDocs(collection(db, 'clubs'));
          if (!clubsSnap.empty) {
            for (const clubDoc of clubsSnap.docs) {
              const clubData = clubDoc.data();
              const membersList = clubData.members || [];
              const hasMember = membersList.some((m: any) => m.studentId === x.id);
              if (hasMember) {
                const updatedMembers = membersList.filter((m: any) => m.studentId !== x.id);
                await setDoc(clubDoc.ref, { ...clubData, members: updatedMembers });

                // Delete club attendance records
                const clubAttQuery = query(collection(db, 'club_attendance'), where('clubId', '==', clubDoc.id));
                const clubAttSnap = await getDocs(clubAttQuery);
                if (!clubAttSnap.empty) {
                  const clubAttBatch = writeBatch(db);
                  let changedAtt = false;
                  clubAttSnap.docs.forEach(caDoc => {
                    const caData = caDoc.data();
                    if (caData.records?.[x.id]) {
                      const recs = { ...caData.records };
                      delete recs[x.id];
                      clubAttBatch.update(caDoc.ref, { records: recs });
                      changedAtt = true;
                    }
                  });
                  if (changedAtt) {
                    await clubAttBatch.commit();
                  }
                }

                // Delete club evaluations
                try {
                  const evalSnap = await getDocs(query(collection(db, 'club_evaluations'), where('clubId', '==', clubDoc.id)));
                  if (!evalSnap.empty) {
                    const evalDoc = evalSnap.docs[0];
                    const evalData = evalDoc.data();
                    if (evalData.records?.[x.id]) {
                      const recs = { ...evalData.records };
                      delete recs[x.id];
                      await setDoc(evalDoc.ref, { ...evalData, records: recs });
                    }
                  }
                } catch (err) {
                  console.error('Error cleaning evaluations:', err);
                }
              }
            }
          }
        }
      }

      setSavedAt(new Date());
    } catch (e: any) {
      alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const updateStudents = (fn: (students: Student[]) => Student[]) => {
    const next = classes.map(c => c.classId === classId ? { ...c, students: fn(c.students) } : c);
    save(next);
  };

  const addStudent = () => {
    updateStudents(s => [...s, {
      id: `${classId}_s${Date.now()}`,
      code: '', name: 'นักเรียนใหม่', emoji: '🧒',
    }]);
  };

  const removeStudent = (sid: string) => {
    if (!confirm('ลบนักเรียนคนนี้?')) return;
    updateStudents(s => s.filter(x => x.id !== sid));
  };

  const updateStudent = (sid: string, patch: Partial<Student>) => {
    updateStudents(s => s.map(x => x.id === sid ? { ...x, ...patch } : x));
  };

  // ─── CSV import ───
  const importCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
        if (lines.length === 0) throw new Error('ไฟล์ว่าง');

        // Detect header row (if first cell is "รหัส" or "code")
        const first = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        const hasHeader = /รหัส|code/i.test(first[0]);
        const dataLines = hasHeader ? lines.slice(1) : lines;

        const newStudents: Student[] = dataLines.map((line, i) => {
          // CSV-aware split (handle commas inside quotes)
          const cells: string[] = [];
          let cur = ''; let inQ = false;
          for (const ch of line) {
            if (ch === '"') inQ = !inQ;
            else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
            else cur += ch;
          }
          cells.push(cur);
          const [code, name, emoji] = cells.map(c => c.trim().replace(/^"|"$/g, ''));
          return {
            id: `${classId}_s${Date.now()}_${i}`,
            code: code || '',
            name: name || code || `นักเรียน ${i + 1}`,
            emoji: emoji || '🧒',
          };
        }).filter(s => s.name);

        if (newStudents.length === 0) throw new Error('ไม่พบรายชื่อในไฟล์');

        const mode = confirm(
          `พบ ${newStudents.length} รายชื่อในไฟล์\n\n` +
          `[OK] = แทนที่รายชื่อเดิมทั้งหมด\n` +
          `[Cancel] = ต่อท้ายรายชื่อเดิม`
        );
        updateStudents(s => mode ? newStudents : [...s, ...newStudents]);
      } catch (e: any) {
        alert('❌ อ่านไฟล์ไม่สำเร็จ: ' + (e?.message || e));
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const exportCsv = () => {
    if (!current) return;
    const rows = [['รหัส', 'ชื่อ', 'emoji']];
    current.students.forEach(s => rows.push([s.code || '', s.name, s.emoji || '']));
    const csv = '\ufeff' + rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `รายชื่อ_${current.label}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Excel exports ───
  // 1) Single class as Excel
  const exportExcelClass = () => {
    if (!current) return;
    const wb = XLSX.utils.book_new();
    const data = [['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-สกุล', 'Emoji'],
      ...current.students.map((s, i) => [i + 1, s.code || '', s.name, s.emoji || ''])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, current.label.replace(/\//g, '-'));
    XLSX.writeFile(wb, `รายชื่อ_${current.label.replace(/\//g, '-')}.xlsx`);
  };

  // 2) Summary across classes (counts, gender estimate)
  const exportExcelSummary = () => {
    const wb = XLSX.utils.book_new();
    const isMale = (n: string) => /เด็กชาย|นาย|ด\.ช\./.test(n);
    const isFemale = (n: string) => /เด็กหญิง|น\.ส\.|ด\.ญ\.|นางสาว|นาง/.test(n);
    const data: any[][] = [['ลำดับ', 'ชั้นเรียน', 'จำนวนนักเรียน', 'ชาย', 'หญิง', 'อื่น ๆ']];
    let totalAll = 0, totalM = 0, totalF = 0, totalO = 0;
    classes.forEach((c, i) => {
      const m = c.students.filter(s => isMale(s.name)).length;
      const f = c.students.filter(s => isFemale(s.name)).length;
      const o = c.students.length - m - f;
      data.push([i + 1, c.label, c.students.length, m, f, o]);
      totalAll += c.students.length; totalM += m; totalF += f; totalO += o;
    });
    data.push(['', 'รวมทั้งหมด', totalAll, totalM, totalF, totalO]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, 'สรุปจำนวนนักเรียน');
    XLSX.writeFile(wb, `สรุปจำนวนนักเรียน_โรงเรียนบ้านคลองมดแดง.xlsx`);
  };

  // 3) Overview: all classes in one workbook (multiple sheets)
  const exportExcelAll = () => {
    const wb = XLSX.utils.book_new();
    // Summary sheet first
    const summary: any[][] = [['ลำดับ', 'ชั้นเรียน', 'จำนวนนักเรียน']];
    let total = 0;
    classes.forEach((c, i) => {
      summary.push([i + 1, c.label, c.students.length]);
      total += c.students.length;
    });
    summary.push(['', 'รวมทั้งหมด', total]);
    const wsSum = XLSX.utils.aoa_to_sheet(summary);
    wsSum['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSum, '📊 สรุป');

    // One sheet per class
    classes.forEach(c => {
      if (c.students.length === 0) return;
      const data = [['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-สกุล', 'Emoji'],
        ...c.students.map((s, i) => [i + 1, s.code || '', s.name, s.emoji || ''])];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 36 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, ws, c.label.replace(/\//g, '-').slice(0, 31));
    });
    XLSX.writeFile(wb, `รายชื่อนักเรียนทั้งหมด_โรงเรียนบ้านคลองมดแดง.xlsx`);
  };

  const exportAttendanceHistory = async () => {
    try {
      const q = collection(db, 'attendance');
      const snap = await getDocs(q);
      const docs: any[] = [];
      snap.forEach(d => docs.push(d.data()));

      const statusTh: Record<string, string> = {
        present: 'มาเรียน',
        absent: 'ขาดเรียน',
        leave: 'ลา'
      };

      const wb = XLSX.utils.book_new();
      
      classes.forEach(c => {
        const classDocs = docs.filter(d => d.classId === c.classId);
        if (classDocs.length === 0) return;
        
        const data: any[][] = [['วันที่', 'รหัสประจำตัว', 'ชื่อ-สกุล', 'สถานะ', 'หมายเหตุ']];
        
        // Sort documents by date
        classDocs.sort((a, b) => a.date.localeCompare(b.date));
        
        classDocs.forEach(d => {
          c.students.forEach(s => {
            const rec = d.records?.[s.id];
            if (rec) {
              data.push([
                d.date,
                s.code || '',
                s.name,
                statusTh[rec.status] || rec.status,
                rec.note || ''
              ]);
            }
          });
        });

        if (data.length > 1) {
          const ws = XLSX.utils.aoa_to_sheet(data);
          ws['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(wb, ws, c.label.replace(/\//g, '-').slice(0, 31));
        }
      });
      
      if (wb.SheetNames.length === 0) {
        alert('ยังไม่มีข้อมูลการมาเรียนในระบบ');
        return;
      }
      XLSX.writeFile(wb, `ประวัติการมาเรียนทั้งหมด_โรงเรียนบ้านคลองมดแดง.xlsx`);
    } catch (e) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูลประวัติการมาเรียน');
    }
  };

  const downloadTemplate = () => {
    const csv = '\ufeff' + 'รหัส,ชื่อ,emoji\n68001,นาย ก. ใจดี,👦\n68002,น.ส. ข. ใจงาม,👧\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'template_นักเรียน.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (!current) return <PageLoading compact title="กำลังโหลดรายชื่อ" message="กำลังเตรียมข้อมูลชั้นเรียน" />;

  return (
    <div>
      {/* Class picker + status */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={classId} onChange={e => setClassId(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #FFEDD5', fontWeight: 700, minWidth: 180 }}>
          {classes.map(c => <option key={c.classId} value={c.classId}>{c.label} ({c.students.length} คน)</option>)}
        </select>
        <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
          📊 รวม <b style={{ color: '#FF6A01' }}>{classes.reduce((s, c) => s + c.students.length, 0)}</b> คน · {classes.length} ชั้นเรียน
        </span>
        {saving && <span style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 700 }}>💾 กำลังบันทึก…</span>}
        {savedAt && !saving && <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>✓ {savedAt.toLocaleTimeString('th-TH')}</span>}
      </div>

      {/* CSV toolbar */}
      <div style={{
        background: '#FFF7ED', border: '1px dashed #FFD7B0', borderRadius: 12,
        padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 800, color: '#7C2D12', fontSize: '0.9rem' }}>📥 นำเข้า/ส่งออก CSV:</span>
        <label style={{
          background: '#3B82F6', color: 'white', padding: '6px 14px', borderRadius: 8,
          fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Upload size={14} />Import CSV
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
        </label>
        <button onClick={exportCsv} style={{
          background: '#10B981', color: 'white', padding: '6px 14px', borderRadius: 8, border: 'none',
          fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Download size={14} />CSV
        </button>
        <button onClick={exportExcelClass} style={xBtn('#0E7C66')}>
          <FileSpreadsheet size={14} />Excel ห้องนี้
        </button>
        <button onClick={exportExcelSummary} style={xBtn('#7C3AED')}>
          <FileSpreadsheet size={14} />Excel สรุป
        </button>
        <button onClick={exportExcelAll} style={xBtn('#0F172A')}>
          <FileSpreadsheet size={14} />Excel ภาพรวมทั้งหมด
        </button>
        <button onClick={exportAttendanceHistory} style={xBtn('#D97706')} title="ดาวน์โหลดประวัติการมาเรียนรายวัน">
          <FileSpreadsheet size={14} />ประวัติเวลาเรียน
        </button>
        <button onClick={downloadTemplate} style={{
          background: 'white', color: '#7C2D12', padding: '6px 14px', borderRadius: 8, border: '1px solid #FFEDD5',
          fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          📄 เทมเพลต
        </button>
        <span style={{ fontSize: '0.72rem', color: '#94A3B8', marginLeft: 'auto' }}>
          รูปแบบ: <code>รหัส, ชื่อ, emoji</code>
        </span>
      </div>

      {/* Student table */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #FFEDD5', overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '50px 60px 130px 1fr 60px',
          background: 'linear-gradient(135deg,#0F172A,#1E3A8A)', color: 'white',
          padding: '10px 14px', fontSize: '0.8rem', fontWeight: 800,
        }}>
          <span>#</span><span></span><span>รหัส</span><span>ชื่อ-นามสกุล</span><span></span>
        </div>
        {current.students.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94A3B8' }}>
            ยังไม่มีรายชื่อ — Import CSV หรือกดเพิ่มทีละคน
          </div>
        ) : current.students.map((s, i) => (
          <div key={s.id} style={{
            display: 'grid', gridTemplateColumns: '50px 60px 130px 1fr 60px',
            padding: '8px 14px', alignItems: 'center', gap: 8,
            borderBottom: '1px solid #FFF7ED',
          }}>
            <span style={{ color: '#94A3B8', fontWeight: 700 }}>{i + 1}</span>
            <input value={s.emoji || ''} onChange={e => updateStudent(s.id, { emoji: e.target.value })}
              style={{ width: 40, padding: 4, borderRadius: 6, border: '1px solid #E2E8F0', textAlign: 'center', fontSize: '1.2rem' }} />
            <input value={s.code || ''} onChange={e => updateStudent(s.id, { code: e.target.value })}
              placeholder="รหัส"
              style={{ padding: 6, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.85rem' }} />
            <input value={s.name} onChange={e => updateStudent(s.id, { name: e.target.value })}
              placeholder="ชื่อ-นามสกุล"
              style={{ padding: 6, borderRadius: 6, border: '1px solid #E2E8F0', fontSize: '0.9rem' }} />
            <button onClick={() => removeStudent(s.id)}
              style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', justifySelf: 'end' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button onClick={addStudent} style={{
          width: '100%', padding: '12px', background: 'white', border: 'none',
          borderTop: '2px dashed #FFD7B0', color: '#FF6A01', fontWeight: 800, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <UserPlus size={16} />เพิ่มนักเรียน
        </button>
      </div>

      <div className="alert alert-info small mt-3 mb-0">
        💡 <b>เคล็ดลับ:</b> ดาวน์โหลด <b>เทมเพลต CSV</b> → กรอกในโปรแกรม Excel/Google Sheets → Save as CSV (UTF-8) → Import กลับมา
      </div>
    </div>
  );
}

const xBtn = (bg: string): React.CSSProperties => ({
  background: bg, color: 'white', padding: '6px 14px', borderRadius: 8, border: 'none',
  fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
});
