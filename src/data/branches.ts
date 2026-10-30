import { SCHOOL_NAME } from '../config/siteLinks';

// ─── ครูโรงเรียนสาขา ───
// เก็บแยกคนละ collection กับ "personnel" ของโรงเรียนหลักโดยตั้งใจ
// เพราะเป็นข้อมูลสำหรับ "แสดงบนหน้าบุคลากร" อย่างเดียว ไม่เกี่ยวกับระบบงานครู
// จึงต้องไม่ถูกนับรวมใน:
//   · จำนวนบุคลากรบนหน้าแรก
//   · ตัวตรวจสอบรายชื่อบุคลากรทางการ (PersonnelSync)
//   · รายชื่อครูประจำชั้น / สิทธิ์เข้าใช้ระบบ
export const BRANCH_PERSONNEL_COLLECTION = 'branch_personnel';

export interface Branch {
  id: string;
  name: string;
  shortName: string;
}

export const BRANCHES: Branch[] = [
  { id: 'chumnumsai', name: `${SCHOOL_NAME} สาขาบ้านใหม่ชุมนุมไทร`, shortName: 'สาขาบ้านใหม่ชุมนุมไทร' },
  { id: 'pakha', name: `${SCHOOL_NAME} สาขาป่าคา`, shortName: 'สาขาป่าคา' },
];

export function branchById(id: string): Branch | undefined {
  return BRANCHES.find(b => b.id === id);
}

export interface BranchPerson {
  id: string;
  branchId: string;
  name: string;
  position: string;
  major?: string;
  phone?: string;
  websiteUrl?: string;
  image?: string;
  order?: number;
}

/** เรียงตามลำดับที่กำหนด ถ้าเท่ากันเรียงตามชื่อ */
export function sortBranchPeople(people: BranchPerson[]): BranchPerson[] {
  return [...people].sort((a, b) => {
    const oa = a.order ?? 999;
    const ob = b.order ?? 999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, 'th');
  });
}

/** จัดกลุ่มตามสาขา เรียงตามลำดับสาขาใน BRANCHES */
export function groupByBranch(people: BranchPerson[]): { branch: Branch; people: BranchPerson[] }[] {
  return BRANCHES
    .map(branch => ({
      branch,
      people: sortBranchPeople(people.filter(p => p.branchId === branch.id)),
    }))
    .filter(group => group.people.length > 0);
}
