// จัดการครูโรงเรียนสาขา (เพิ่ม/แก้ไข/ลบ + วางข้อมูลทีละหลายคน)
// เขียนลง collection "branch_personnel" เท่านั้น ไม่แตะข้อมูลบุคลากรโรงเรียนหลัก
import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Trash2, Edit2, X, Save, ClipboardPaste } from 'lucide-react';
import { db } from '../firebase';
import DriveImage from './DriveImage';
import { toast } from './GlobalToast';
import {
  BRANCHES,
  BRANCH_PERSONNEL_COLLECTION,
  sortBranchPeople,
  type BranchPerson,
} from '../data/branches';

const EMPTY = {
  branchId: BRANCHES[0].id,
  name: '',
  position: '',
  major: '',
  phone: '',
  websiteUrl: '',
  image: '',
};

export default function BranchPersonnelManager() {
  const [people, setPeople] = useState<BranchPerson[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(collection(db, BRANCH_PERSONNEL_COLLECTION), snap => {
      const items: BranchPerson[] = [];
      snap.forEach(d => items.push({ id: d.id, ...(d.data() as Omit<BranchPerson, 'id'>) }));
      setPeople(items);
    });
  }, []);

  const visible = useMemo(() => {
    const list = filterBranch === 'all' ? people : people.filter(p => p.branchId === filterBranch);
    return sortBranchPeople(list);
  }, [people, filterBranch]);

  const reset = () => { setEditingId(null); setForm({ ...EMPTY }); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { toast.error('กรุณากรอกชื่อ'); return; }
    setBusy(true);
    try {
      const payload = {
        branchId: form.branchId,
        name: form.name.trim(),
        position: form.position.trim(),
        major: form.major.trim(),
        phone: form.phone.trim(),
        websiteUrl: form.websiteUrl.trim(),
        image: form.image.trim(),
        order: people.length + 1,
      };
      if (editingId) {
        await setDoc(doc(db, BRANCH_PERSONNEL_COLLECTION, editingId), payload, { merge: true });
        toast.success('บันทึกการแก้ไขแล้ว');
      } else {
        await addDoc(collection(db, BRANCH_PERSONNEL_COLLECTION), payload);
        toast.success('เพิ่มครูสาขาแล้ว');
      }
      reset();
    } catch (error) {
      console.error('Unable to save branch person', error);
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (person: BranchPerson) => {
    if (!window.confirm(`ลบ ${person.name} ออกจากรายชื่อครูสาขา?`)) return;
    try {
      await deleteDoc(doc(db, BRANCH_PERSONNEL_COLLECTION, person.id));
      toast.success('ลบแล้ว');
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  // วางข้อมูลจากตาราง: ชื่อ | ตำแหน่ง | วิชาเอก | เบอร์โทร | ลิงก์รูป | เว็บไซต์
  const importBulk = async () => {
    const rows = bulkText.split('\n').map(r => r.trim()).filter(Boolean);
    if (rows.length === 0) { toast.error('ยังไม่ได้วางข้อมูล'); return; }
    setBusy(true);
    try {
      let added = 0;
      let order = people.length;
      for (const row of rows) {
        const cols = row.split(/\t|\s*\|\s*|,(?=\s*\S)/).map(c => c.trim());
        if (!cols[0]) continue;
        order += 1;
        added += 1;
        await addDoc(collection(db, BRANCH_PERSONNEL_COLLECTION), {
          branchId: form.branchId,
          name: cols[0] || '',
          position: cols[1] || '',
          major: cols[2] || '',
          phone: cols[3] || '',
          image: cols[4] || '',
          websiteUrl: cols[5] || '',
          order,
        });
      }
      setBulkText('');
      toast.success(`นำเข้า ${added} คนเรียบร้อย`);
    } catch (error) {
      console.error('Bulk import failed', error);
      toast.error('นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row g-4">
      <div className="col-lg-5">
        <div className="p-4 bg-white rounded-4 border">
          <h5 className="fw-bold mb-3">{editingId ? 'แก้ไขครูสาขา' : 'เพิ่มครูสาขา'}</h5>

          <div className="alert alert-info small py-2">
            ข้อมูลชุดนี้<b>แยกจากบุคลากรโรงเรียนหลัก</b> ใช้แสดงบนหน้าบุคลากรอย่างเดียว
            ไม่ถูกนับรวมในจำนวนบุคลากรหน้าแรก และไม่เกี่ยวกับระบบงานครู
          </div>

          <form onSubmit={submit}>
            <label className="form-label small fw-bold">สาขา</label>
            <select className="form-select mb-3" value={form.branchId}
              onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
              {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.shortName}</option>)}
            </select>

            <input className="form-control mb-2" placeholder="ชื่อ-นามสกุล" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <input className="form-control mb-2" placeholder="ตำแหน่ง (เช่น ครูผู้ช่วย)" value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
            <input className="form-control mb-2" placeholder="วิชาเอก" value={form.major}
              onChange={e => setForm(f => ({ ...f, major: e.target.value }))} />
            <input className="form-control mb-2" placeholder="เบอร์โทร" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className="form-control mb-2" placeholder="ลิงก์รูป (Google Drive)" value={form.image}
              onChange={e => setForm(f => ({ ...f, image: e.target.value }))} />
            <input className="form-control mb-3" placeholder="ลิงก์เว็บไซต์ (ถ้ามี)" value={form.websiteUrl}
              onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))} />

            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-primary d-inline-flex align-items-center gap-2" disabled={busy}>
                <Save size={16} />{editingId ? 'บันทึก' : 'เพิ่ม'}
              </button>
              {editingId && (
                <button type="button" className="btn btn-light border" onClick={reset}><X size={16} /></button>
              )}
            </div>
          </form>

          <hr className="my-4" />

          <div className="fw-bold small mb-1 d-flex align-items-center gap-2">
            <ClipboardPaste size={15} />วางข้อมูลทีละหลายคน
          </div>
          <div className="small text-muted mb-2">
            บรรทัดละ 1 คน คั่นด้วย Tab หรือ | ตามลำดับ:<br />
            <code>ชื่อ | ตำแหน่ง | วิชาเอก | เบอร์โทร | ลิงก์รูป | เว็บไซต์</code><br />
            จะเข้าสาขา “{BRANCHES.find(b => b.id === form.branchId)?.shortName}” ตามที่เลือกไว้ด้านบน
          </div>
          <textarea className="form-control mb-2" rows={5} value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={'นางสาว ก ข | ครูผู้ช่วย | ภาษาไทย | 08xxxxxxxx'} />
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={importBulk} disabled={busy}>
            {busy ? 'กำลังนำเข้า...' : 'นำเข้าข้อมูล'}
          </button>
        </div>
      </div>

      <div className="col-lg-7">
        <div className="p-4 bg-white rounded-4 border">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <h5 className="fw-bold mb-0">รายชื่อครูสาขา ({people.length})</h5>
            <select className="form-select form-select-sm" style={{ width: 'auto' }}
              value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="all">ทุกสาขา</option>
              {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.shortName}</option>)}
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="text-center text-muted py-5 small">
              ยังไม่มีข้อมูลครูสาขา — เพิ่มทีละคน หรือวางข้อมูลทั้งชุดจากช่องด้านซ้าย
            </div>
          ) : (
            <div className="row g-3">
              {visible.map(person => (
                <div key={person.id} className="col-md-6">
                  <div className="p-3 rounded-4 border bg-white d-flex gap-3 align-items-center">
                    <DriveImage src={person.image} style={{ width: 50, height: 50, borderRadius: 12, objectFit: 'cover' }} />
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="fw-bold small text-truncate">{person.name}</div>
                      <div className="text-muted small text-truncate">{person.position}</div>
                      <div className="badge border mt-1" style={{ fontSize: 9, background: '#E0F2FE', color: '#0369A1' }}>
                        {BRANCHES.find(b => b.id === person.branchId)?.shortName || person.branchId}
                      </div>
                    </div>
                    <div className="d-flex flex-column gap-1">
                      <button className="btn btn-sm btn-light border" title="แก้ไข"
                        onClick={() => {
                          setEditingId(person.id);
                          setForm({
                            branchId: person.branchId,
                            name: person.name || '',
                            position: person.position || '',
                            major: person.major || '',
                            phone: person.phone || '',
                            websiteUrl: person.websiteUrl || '',
                            image: person.image || '',
                          });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-sm btn-light border text-danger" title="ลบ"
                        onClick={() => remove(person)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
