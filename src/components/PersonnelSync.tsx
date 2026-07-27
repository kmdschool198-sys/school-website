// เทียบรายชื่อบุคลากรใน Firestore กับรายชื่อทางการ แล้วเติมเฉพาะคนที่ยังไม่มี
// ตรวจก่อนเขียนเสมอ กดซ้ำกี่ครั้งก็ไม่เกิดข้อมูลซ้ำ
import { useMemo, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { UserPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import {
  OFFICIAL_PERSONNEL,
  normalizePersonName,
  toPersonnelDoc,
  type OfficialPerson,
} from '../data/personnelRoster';
import { toast } from './GlobalToast';

export default function PersonnelSync({ existingNames }: { existingNames: string[] }) {
  const [adding, setAdding] = useState(false);

  const inDb = useMemo(
    () => new Set(existingNames.map(normalizePersonName)),
    [existingNames],
  );

  // คนที่มีในเอกสารทางการแต่ยังไม่มีในระบบ
  const missing = useMemo(
    () => OFFICIAL_PERSONNEL.filter(p => !inDb.has(normalizePersonName(p.name))),
    [inDb],
  );

  // คนที่มีในระบบแต่ไม่อยู่ในเอกสารทางการ (อาจย้ายเข้ามาใหม่ หรือพิมพ์ชื่อผิด)
  const official = useMemo(
    () => new Set(OFFICIAL_PERSONNEL.map(p => normalizePersonName(p.name))),
    [],
  );
  const extra = useMemo(
    () => existingNames.filter(n => !official.has(normalizePersonName(n))),
    [existingNames, official],
  );

  const addMissing = async (people: OfficialPerson[]) => {
    setAdding(true);
    try {
      let order = existingNames.length;
      for (const person of people) {
        order += 1;
        await addDoc(collection(db, 'personnel'), toPersonnelDoc(person, order));
      }
      toast.success(`เพิ่มบุคลากร ${people.length} คนเรียบร้อย`);
    } catch (error) {
      console.error('Unable to add personnel', error);
      toast.error('เพิ่มไม่สำเร็จ — ตรวจสอบสิทธิ์การเข้าใช้งาน');
    } finally {
      setAdding(false);
    }
  };

  if (missing.length === 0 && extra.length === 0) {
    return (
      <div className="alert alert-success d-flex align-items-center gap-2 py-2 mb-3">
        <CheckCircle2 size={17} />
        <span className="small">
          รายชื่อครบตามเอกสารทางการแล้ว <b>{existingNames.length} คน</b>
        </span>
      </div>
    );
  }

  return (
    <div className="alert alert-warning mb-3">
      <div className="d-flex align-items-center gap-2 fw-bold mb-2">
        <AlertTriangle size={17} />
        รายชื่อบุคลากรยังไม่ตรงกับเอกสารทางการ
      </div>
      <div className="small mb-2">
        ในระบบมี <b>{existingNames.length}</b> คน · เอกสารทางการมี <b>{OFFICIAL_PERSONNEL.length}</b> คน
      </div>

      {missing.length > 0 && (
        <>
          <div className="small fw-bold mb-1">ยังไม่มีในระบบ {missing.length} คน:</div>
          <ul className="small mb-2 ps-3">
            {missing.map(p => (
              <li key={p.name}>{p.name} — {p.pos} ({p.major})</li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-sm btn-warning d-inline-flex align-items-center gap-2"
            disabled={adding}
            onClick={() => addMissing(missing)}
          >
            <UserPlus size={15} />
            {adding ? 'กำลังเพิ่ม...' : `เพิ่ม ${missing.length} คนที่ขาด`}
          </button>
        </>
      )}

      {extra.length > 0 && (
        <div className="small mt-2">
          <span className="fw-bold">มีในระบบแต่ไม่อยู่ในเอกสาร:</span> {extra.join(', ')}
          <div className="text-muted">หากถูกต้องแล้วไม่ต้องทำอะไร (เช่น บุคลากรที่ย้ายเข้ามาใหม่)</div>
        </div>
      )}
    </div>
  );
}
