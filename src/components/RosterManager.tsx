import { useState, useEffect, useRef } from 'react';
import {
  doc, onSnapshot, getDoc, getDocs, collection, writeBatch, query, where,
  type DocumentData, type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { buildSeedRosters } from '../utils/useSchoolRoster';
import { Trash2, UserPlus, Upload, Download, RefreshCw, Save } from 'lucide-react';
import { PageLoading } from './PageState';
import type { ResultAnnouncement } from '../data/results';
import {
  buildStudentCountRows,
  detectRosterChanges,
  findExistingStudent,
  mergeSavedRoster,
  syncClubMembers,
  syncDraftResultRows,
  type LinkedClubMember,
  type RosterClass,
  type RosterStudent,
  type StudentCountRow,
} from '../utils/studentRosterSync';

type Student = RosterStudent;
type ClassRoster = RosterClass;

const seedClasses = (): ClassRoster[] => {
  return buildSeedRosters().map(r => ({
    classId: r.classId,
    label: r.label,
    students: r.students.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      emoji: s.emoji,
    })),
  }));
};

export default function RosterManager() {
  const [classes, setClasses] = useState<ClassRoster[]>(seedClasses);
  const [classId, setClassId] = useState<string>('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'attendance_classes'), snap => {
      if (snap.exists()) {
        const d = snap.data() as { classes: ClassRoster[] };
        if (d.classes?.length) {
          if (isDirtyRef.current) return;
          // keep the saved class ids: attendance history is keyed by them
          setClasses(prev => mergeSavedRoster(prev, d.classes));
        }
      }
    });
  }, []);

  useEffect(() => {
    // also when the saved roster replaces the built-in ids, so the selection never points nowhere
    if (classes.length && !classes.some(c => c.classId === classId)) setClassId(classes[0].classId);
  }, [classes]);

  // Debounced auto-save
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      save(classes);
    }, 1500);
    return () => clearTimeout(timer);
  }, [classes, isDirty]);

  const current = classes.find(c => c.classId === classId);

  const save = async (nextToSave?: ClassRoster[], forceSync = false) => {
    const rawTarget = nextToSave || classes;
    const cleanClasses: ClassRoster[] = rawTarget.map(cls => ({
      classId: cls.classId,
      label: cls.label,
      students: (cls.students || []).map(s => ({
        id: String(s.id || '').trim() || `${cls.classId}_s${Date.now()}`,
        code: String(s.code || '').trim(),
        name: String(s.name || '').trim(),
        emoji: String(s.emoji || '🧒').trim(),
      }))
    }));

    const changes = detectRosterChanges(classes, cleanClasses);
    setClasses(cleanClasses);
    setSaving(true);
    try {
      const now = Date.now();
      const studentCountRef = doc(db, 'config', 'students_count');
      const studentCountSnapshot = await getDoc(studentCountRef);
      const existingCountRows = studentCountSnapshot.exists()
        && Array.isArray(studentCountSnapshot.data().rows)
        ? studentCountSnapshot.data().rows as StudentCountRow[]
        : [];
      const countRows = buildStudentCountRows(cleanClasses, existingCountRows);
      const configBatch = writeBatch(db);
      configBatch.set(doc(db, 'config', 'attendance_classes'), { classes: cleanClasses, updatedAt: now });
      configBatch.set(studentCountRef, { rows: countRows, updatedAt: now }, { merge: true });
      await configBatch.commit();

      // Removed and moved students must disappear from their previous class history.
      if (changes.removedFromClass.length > 0) {
        const affectedClasses = new Set(changes.removedFromClass.map(item => item.classId));
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

              changes.removedFromClass.forEach(x => {
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
      }

      const shouldSyncDependents = forceSync || changes.hasChanges;
      let clubsSnapshot: QuerySnapshot<DocumentData> | null = null;

      if (shouldSyncDependents) {
        // Club member cards are references by studentId; refresh copied labels for every reader.
        clubsSnapshot = await getDocs(collection(db, 'clubs'));
        if (!clubsSnapshot.empty) {
          const clubBatch = writeBatch(db);
          let changedClubs = 0;
          clubsSnapshot.docs.forEach(clubDoc => {
            const clubData = clubDoc.data();
            const result = syncClubMembers(
              (clubData.members || []) as LinkedClubMember[],
              changes.nextIndex,
            );
            if (result.changed) {
              clubBatch.update(clubDoc.ref, { members: result.members, updatedAt: now });
              changedClubs++;
            }
          });
          if (changedClubs > 0) await clubBatch.commit();
        }

        // Draft results follow the live roster. Published results remain an audit snapshot.
        const resultsSnapshot = await getDocs(collection(db, 'results'));
        if (!resultsSnapshot.empty) {
          const resultBatch = writeBatch(db);
          let changedResults = 0;
          resultsSnapshot.docs.forEach(resultDoc => {
            const result = { id: resultDoc.id, ...resultDoc.data() } as ResultAnnouncement;
            if (result.visible) return;
            const rosterClass = cleanClasses.find((item: ClassRoster) => item.classId === result.classId);
            if (!rosterClass) return;
            const records = syncDraftResultRows(result.records || [], rosterClass.students);
            resultBatch.update(resultDoc.ref, {
              className: rosterClass.label,
              records,
              rosterUpdatedAt: now,
            });
            changedResults++;
          });
          if (changedResults > 0) await resultBatch.commit();
        }
      }

      // Permanently deleted students are removed from sensitive operational records.
      for (const studentId of changes.deletedIds) {
          // 1. Delete body metrics records
          const bmQuery = query(collection(db, 'log_body_metrics'), where('studentId', '==', studentId));
          const bmSnap = await getDocs(bmQuery);
          if (!bmSnap.empty) {
            const bmBatch = writeBatch(db);
            bmSnap.docs.forEach(d => bmBatch.delete(d.ref));
            await bmBatch.commit();
          }

          // 2. Delete savings records
          const svQuery = query(collection(db, 'log_saving'), where('studentId', '==', studentId));
          const svSnap = await getDocs(svQuery);
          if (!svSnap.empty) {
            const svBatch = writeBatch(db);
            svSnap.docs.forEach(d => svBatch.delete(d.ref));
            await svBatch.commit();
          }

          // 3. Remove club attendance and evaluations for clubs the student belonged to.
          const clubsSnap = clubsSnapshot || await getDocs(collection(db, 'clubs'));
          if (!clubsSnap.empty) {
            for (const clubDoc of clubsSnap.docs) {
              const clubData = clubDoc.data();
              const membersList = clubData.members || [];
              const hasMember = membersList.some((member: LinkedClubMember) => member.studentId === studentId);
              if (hasMember) {
                const clubAttQuery = query(collection(db, 'club_attendance'), where('clubId', '==', clubDoc.id));
                const clubAttSnap = await getDocs(clubAttQuery);
                if (!clubAttSnap.empty) {
                  const clubAttBatch = writeBatch(db);
                  let changedAtt = false;
                  clubAttSnap.docs.forEach(caDoc => {
                    const caData = caDoc.data();
                    if (caData.records?.[studentId]) {
                      const recs = { ...caData.records };
                      delete recs[studentId];
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
                    if (evalData.records?.[studentId]) {
                      const recs = { ...evalData.records };
                      delete recs[studentId];
                      const evalBatch = writeBatch(db);
                      evalBatch.update(evalDoc.ref, { records: recs });
                      await evalBatch.commit();
                    }
                  }
                } catch (err) {
                  console.error('Error cleaning evaluations:', err);
                }
              }
            }
          }
      }

      setSavedAt(new Date());
      setIsDirty(false);
      isDirtyRef.current = false;
    } catch (e: any) {
      alert('❌ บันทึกไม่สำเร็จ: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const updateStudents = (fn: (students: Student[]) => Student[]) => {
    setIsDirty(true);
    isDirtyRef.current = true;
    setClasses(prev => prev.map(c => c.classId === classId ? { ...c, students: fn(c.students) } : c));
  };

  const addStudent = () => {
    updateStudents(s => [...s, {
      id: `${classId}_s${Date.now()}`,
      code: '', name: 'นักเรียนใหม่', emoji: '🧒',
    }]);
  };

  const removeStudent = (sid: string) => {
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('ยืนยันการลบนักเรียนคนนี้ออกจากฐานข้อมูล?')) return;
    const next = classes.map(c => c.classId === classId ? { ...c, students: c.students.filter(x => x.id !== sid) } : c);
    setClasses(next);
    save(next);
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

        const usedIds = new Set<string>();
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
          const existing = findExistingStudent(classes, code, name || code);
          let id = existing?.id;
          if (!id || usedIds.has(id)) {
            const safeCode = (code || '').replace(/[^a-zA-Z0-9_-]/g, '_');
            id = safeCode ? `student_${safeCode}` : `${classId}_s${Date.now()}_${i}`;
            while (usedIds.has(id)) id = `${id}_${i}`;
          }
          usedIds.add(id);
          return {
            id,
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
        const currentStudents = classes.find(item => item.classId === classId)?.students || [];
        const mergedStudents = new Map(
          (mode ? [] : currentStudents).map(student => [student.id, student]),
        );
        newStudents.forEach(student => mergedStudents.set(student.id, student));
        const importedIds = new Set(newStudents.map(student => student.id));
        const nextClasses = classes.map(rosterClass => {
          if (rosterClass.classId === classId) {
            return { ...rosterClass, students: Array.from(mergedStudents.values()) };
          }
          return {
            ...rosterClass,
            students: rosterClass.students.filter(student => !importedIds.has(student.id)),
          };
        });
        save(nextClasses);
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
        {isDirty && (
          <button
            onClick={() => save(classes)}
            disabled={saving}
            style={{
              padding: '7px 14px', borderRadius: 8,
              border: 'none', background: 'linear-gradient(135deg,#FF6A01,#FB923C)',
              color: 'white', fontWeight: 800, fontSize: '0.82rem',
              cursor: saving ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(255,106,1,0.3)',
            }}
          >
            <Save size={14} /> บันทึกการแก้ไข
          </button>
        )}
        <button
          onClick={() => save(classes, true)}
          disabled={saving}
          title="อัปเดตยอดสรุป ชุมนุม และผลสอบฉบับร่างจากทะเบียนนี้"
          style={{
            marginLeft: isDirty ? '0' : 'auto', padding: '7px 12px', borderRadius: 8,
            border: '1px solid #FDBA74', background: 'white', color: '#C2410C',
            fontWeight: 800, fontSize: '0.8rem', cursor: saving ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} />ซิงก์ทุกระบบ
        </button>
        {saving && <span style={{ fontSize: '0.78rem', color: '#F59E0B', fontWeight: 700 }}>💾 กำลังบันทึก…</span>}
        {isDirty && !saving && <span style={{ fontSize: '0.78rem', color: '#EA580C', fontWeight: 700 }}>⚠️ แก้ไขแล้ว (รอเซฟ...)</span>}
        {savedAt && !saving && !isDirty && <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>✓ {savedAt.toLocaleTimeString('th-TH')}</span>}
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
        💡 <b>เคล็ดลับ:</b> ดาวน์โหลด <b>เทมเพลต CSV</b> → กรอกในโปรแกรมสเปรดชีต/Google Sheets → Save as CSV (UTF-8) → Import กลับมา
      </div>
    </div>
  );
}
