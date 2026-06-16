import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';

export type HubExcelKind =
  | 'dashboard'
  | 'attendance'
  | 'roster'
  | 'clubAttendance'
  | 'clubs'
  | 'milk'
  | 'brush'
  | 'saving'
  | 'bodyMetrics'
  | 'schoolStats';

interface Student {
  id: string;
  code?: string;
  name?: string;
}

interface ClassRoster {
  classId: string;
  label: string;
  students?: Student[];
}

type Workbook = XLSX.WorkBook;
type AnyRecord = Record<string, any>;

const STATUS_LABELS: Record<string, string> = {
  present: 'มาเรียน',
  absent: 'ขาด',
  leave: 'ลา',
};

export async function exportHubCardExcel(kind: HubExcelKind, title: string) {
  const wb = XLSX.utils.book_new();

  switch (kind) {
    case 'dashboard':
      await addDashboardSheets(wb);
      break;
    case 'attendance':
      await addAttendanceSheets(wb);
      break;
    case 'roster':
      await addRosterSheets(wb);
      break;
    case 'clubAttendance':
      await addClubSheets(wb, true);
      break;
    case 'clubs':
      await addClubSheets(wb, false);
      break;
    case 'milk':
      await addMilkBrushSheets(wb, 'milk');
      break;
    case 'brush':
      await addMilkBrushSheets(wb, 'brush');
      break;
    case 'saving':
      await addCollectionSheet(wb, 'ออมเงิน', 'log_saving');
      break;
    case 'bodyMetrics':
      await addCollectionSheet(wb, 'น้ำหนัก-ส่วนสูง', 'log_body_metrics');
      break;
    case 'schoolStats':
      await addSchoolStatsSheets(wb);
      break;
  }

  XLSX.writeFile(wb, `${safeFileName(title)}_${dateStamp()}.xlsx`);
}

async function addDashboardSheets(wb: Workbook) {
  const classes = await getClassRosters();
  const attendance = await getCollectionRows('attendance');
  const clubs = await getCollectionRows('clubs');
  const savings = await getCollectionRows('log_saving');
  const metrics = await getCollectionRows('log_body_metrics');

  addSheet(wb, 'ภาพรวม', [
    { รายการ: 'ชั้นเรียน', จำนวน: classes.length },
    { รายการ: 'นักเรียนในรายชื่อ', จำนวน: classes.reduce((sum, c) => sum + (c.students?.length || 0), 0) },
    { รายการ: 'เอกสารเช็คชื่อ', จำนวน: attendance.length },
    { รายการ: 'ชุมนุม/กิจกรรม', จำนวน: clubs.length },
    { รายการ: 'รายการออมเงิน', จำนวน: savings.length },
    { รายการ: 'รายการน้ำหนัก-ส่วนสูง', จำนวน: metrics.length },
  ]);
  addSheet(wb, 'รายชื่อนักเรียน', flattenRosters(classes));
  addSheet(wb, 'สรุปเช็คชื่อ', summarizeAttendance(attendance, classes));
  addSheet(wb, 'ชุมนุม', clubs.map(clubSummaryRow));
}

async function addAttendanceSheets(wb: Workbook) {
  const classes = await getClassRosters();
  const attendance = await getCollectionRows('attendance');
  addSheet(wb, 'เช็คชื่อรายคน', flattenAttendance(attendance, classes));
  addSheet(wb, 'สรุปรายวัน', summarizeAttendance(attendance, classes));
}

async function addRosterSheets(wb: Workbook) {
  const classes = await getClassRosters();
  addSheet(wb, 'รายชื่อนักเรียน', flattenRosters(classes));
  addSheet(wb, 'สรุปชั้นเรียน', classes.map(c => ({
    classId: c.classId,
    ชั้นเรียน: c.label,
    จำนวนนักเรียน: c.students?.length || 0,
  })));
}

async function addClubSheets(wb: Workbook, includeAttendance: boolean) {
  const clubs = await getCollectionRows('clubs');
  addSheet(wb, 'ชุมนุม', clubs.map(clubSummaryRow));
  addSheet(wb, 'สมาชิกชุมนุม', clubs.flatMap(clubMemberRows));

  if (includeAttendance) {
    const attendance = await getCollectionRows('club_attendance');
    addSheet(wb, 'เช็คชื่อชุมนุม', flattenClubAttendance(attendance, clubs));
  }
}

async function addMilkBrushSheets(wb: Workbook, mode: 'milk' | 'brush') {
  const classes = await getClassRosters();
  const attendance = await getCollectionRows('attendance');
  const rows = flattenMilkBrush(attendance, classes, mode);
  addSheet(wb, mode === 'milk' ? 'รายงานนม' : 'รายงานแปรงฟัน', rows);
  addSheet(wb, 'สรุปรายวัน', summarizeMilkBrush(rows, mode));
}

async function addSchoolStatsSheets(wb: Workbook) {
  const classes = await getClassRosters();
  const attendance = await getCollectionRows('attendance');
  addSheet(wb, 'สรุปรายเดือน', summarizeMonthlyStats(attendance, classes));
  addSheet(wb, 'เช็คชื่อรายคน', flattenAttendance(attendance, classes));
}

async function addCollectionSheet(wb: Workbook, sheetName: string, collectionName: string) {
  const rows = await getCollectionRows(collectionName);
  addSheet(wb, sheetName, rows);
}

async function getClassRosters(): Promise<ClassRoster[]> {
  const snap = await getDoc(doc(db, 'config', 'attendance_classes'));
  if (!snap.exists()) return [];
  return ((snap.data() as { classes?: ClassRoster[] }).classes || []);
}

async function getCollectionRows(collectionName: string): Promise<AnyRecord[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(d => ({ id: d.id, ...normalizeRow(d.data()) }));
}

function flattenRosters(classes: ClassRoster[]) {
  return classes.flatMap(cls => (cls.students || []).map((student, index) => ({
    ชั้นเรียน: cls.label,
    classId: cls.classId,
    ลำดับ: index + 1,
    studentId: student.id,
    รหัสนักเรียน: student.code || '',
    ชื่อ: student.name || '',
  })));
}

function flattenAttendance(attendance: AnyRecord[], classes: ClassRoster[]) {
  const studentMap = buildStudentMap(classes);
  return attendance.flatMap(docRow => {
    const records = docRow.records || {};
    return Object.entries(records).map(([studentId, record]) => {
      const item = record as AnyRecord;
      const student = studentMap.get(studentId);
      return {
        วันที่: docRow.date || '',
        ชั้นเรียน: student?.classLabel || docRow.classLabel || docRow.classId || '',
        classId: docRow.classId || '',
        studentId,
        รหัสนักเรียน: student?.code || '',
        ชื่อ: student?.name || '',
        สถานะ: STATUS_LABELS[item.status] || item.status || '',
        งดนม: item.noMilk ? 'ใช่' : '',
        งดแปรงฟัน: item.noBrush ? 'ใช่' : '',
        หมายเหตุ: item.note || '',
        updatedAt: formatDateTime(docRow.updatedAt),
      };
    });
  });
}

function summarizeAttendance(attendance: AnyRecord[], classes: ClassRoster[]) {
  const classMap = new Map(classes.map(c => [c.classId, c.label]));
  return attendance.map(docRow => {
    const records = Object.values(docRow.records || {}) as AnyRecord[];
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const leave = records.filter(r => r.status === 'leave').length;
    const total = present + absent + leave;
    return {
      วันที่: docRow.date || '',
      ชั้นเรียน: classMap.get(docRow.classId) || docRow.classLabel || docRow.classId || '',
      classId: docRow.classId || '',
      ทั้งหมด: total,
      มาเรียน: present,
      ขาด: absent,
      ลา: leave,
      อัตรามาเรียน: total ? Math.round((present / total) * 10000) / 100 : 0,
    };
  });
}

function flattenMilkBrush(attendance: AnyRecord[], classes: ClassRoster[], mode: 'milk' | 'brush') {
  const studentMap = buildStudentMap(classes);
  return attendance.flatMap(docRow => Object.entries(docRow.records || {}).map(([studentId, record]) => {
    const item = record as AnyRecord;
    const student = studentMap.get(studentId);
    const isPresent = item.status === 'present';
    const received = mode === 'milk' ? isPresent && !item.noMilk : isPresent && !item.noBrush;
    return {
      วันที่: docRow.date || '',
      ชั้นเรียน: student?.classLabel || docRow.classLabel || docRow.classId || '',
      studentId,
      รหัสนักเรียน: student?.code || '',
      ชื่อ: student?.name || '',
      สถานะ: STATUS_LABELS[item.status] || item.status || '',
      [mode === 'milk' ? 'ได้รับนม' : 'แปรงฟัน']: received ? 'ใช่' : 'ไม่ใช่',
      หมายเหตุ: item.note || '',
    };
  }));
}

function summarizeMilkBrush(rows: AnyRecord[], mode: 'milk' | 'brush') {
  const key = mode === 'milk' ? 'ได้รับนม' : 'แปรงฟัน';
  const map = new Map<string, AnyRecord>();
  rows.forEach(row => {
    const id = `${row.วันที่}|${row.ชั้นเรียน}`;
    const item = map.get(id) || { วันที่: row.วันที่, ชั้นเรียน: row.ชั้นเรียน, ทั้งหมด: 0, จำนวน: 0 };
    item.ทั้งหมด += 1;
    if (row[key] === 'ใช่') item.จำนวน += 1;
    map.set(id, item);
  });
  return Array.from(map.values()).map(row => ({
    ...row,
    ร้อยละ: row.ทั้งหมด ? Math.round((row.จำนวน / row.ทั้งหมด) * 10000) / 100 : 0,
  }));
}

function summarizeMonthlyStats(attendance: AnyRecord[], classes: ClassRoster[]) {
  const classMap = new Map(classes.map(c => [c.classId, c.label]));
  const map = new Map<string, AnyRecord>();
  attendance.forEach(docRow => {
    const month = String(docRow.date || '').slice(0, 7);
    const classId = docRow.classId || '';
    const id = `${month}|${classId}`;
    const item = map.get(id) || {
      เดือน: month,
      ชั้นเรียน: classMap.get(classId) || docRow.classLabel || classId,
      classId,
      วันเช็คชื่อ: 0,
      มาเรียน: 0,
      ขาด: 0,
      ลา: 0,
      นม: 0,
      แปรงฟัน: 0,
    };
    item.วันเช็คชื่อ += 1;
    Object.values(docRow.records || {}).forEach(raw => {
      const record = raw as AnyRecord;
      if (record.status === 'present') {
        item.มาเรียน += 1;
        if (!record.noMilk) item.นม += 1;
        if (!record.noBrush) item.แปรงฟัน += 1;
      } else if (record.status === 'absent') {
        item.ขาด += 1;
      } else if (record.status === 'leave') {
        item.ลา += 1;
      }
    });
    map.set(id, item);
  });
  return Array.from(map.values()).map(row => {
    const total = row.มาเรียน + row.ขาด + row.ลา;
    return {
      ...row,
      รวมรายการ: total,
      อัตรามาเรียน: total ? Math.round((row.มาเรียน / total) * 10000) / 100 : 0,
    };
  });
}

function clubSummaryRow(club: AnyRecord) {
  return {
    clubId: club.id,
    ชื่อชุมนุม: club.name || '',
    ประเภท: club.type || '',
    ครูที่ปรึกษา: club.advisor || '',
    รายละเอียด: club.description || '',
    จำนวนสมาชิก: Array.isArray(club.members) ? club.members.length : 0,
    createdAt: formatDateTime(club.createdAt),
  };
}

function clubMemberRows(club: AnyRecord) {
  return (club.members || []).map((member: AnyRecord, index: number) => ({
    clubId: club.id,
    ชื่อชุมนุม: club.name || '',
    ลำดับ: index + 1,
    studentId: member.studentId || '',
    รหัสนักเรียน: member.code || '',
    ชื่อ: member.name || '',
    ชั้นเรียน: member.classLabel || '',
  }));
}

function flattenClubAttendance(attendance: AnyRecord[], clubs: AnyRecord[]) {
  const clubMap = new Map(clubs.map(club => [club.id, club]));
  return attendance.flatMap(docRow => {
    const club = clubMap.get(docRow.clubId);
    const memberMap = new Map((club?.members || []).map((m: AnyRecord) => [m.studentId, m]));
    return Object.entries(docRow.records || {}).map(([studentId, record]) => {
      const item = record as AnyRecord;
      const member = memberMap.get(studentId) as AnyRecord | undefined;
      return {
        วันที่: docRow.date || '',
        clubId: docRow.clubId || '',
        ชื่อชุมนุม: club?.name || '',
        studentId,
        รหัสนักเรียน: member?.code || '',
        ชื่อ: member?.name || '',
        ชั้นเรียน: member?.classLabel || '',
        สถานะ: STATUS_LABELS[item.status] || item.status || '',
        หมายเหตุ: item.note || '',
        updatedAt: formatDateTime(docRow.updatedAt),
      };
    });
  });
}

function buildStudentMap(classes: ClassRoster[]) {
  const map = new Map<string, { classLabel: string; code: string; name: string }>();
  classes.forEach(cls => {
    (cls.students || []).forEach(student => {
      map.set(student.id, {
        classLabel: cls.label,
        code: student.code || '',
        name: student.name || '',
      });
    });
  });
  return map;
}

function addSheet(wb: Workbook, name: string, rows: AnyRecord[]) {
  const safeRows = rows.length ? rows.map(normalizeRow) : [{ สถานะ: 'ไม่มีข้อมูล' }];
  const ws = XLSX.utils.json_to_sheet(safeRows);
  ws['!cols'] = Object.keys(safeRows[0] || {}).map(key => ({ wch: Math.max(12, Math.min(32, key.length + 8)) }));
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(name));
}

function normalizeRow(row: AnyRecord): AnyRecord {
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, normalizeValue(value)]));
}

function normalizeValue(value: any): any {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString('th-TH');
  if (Array.isArray(value)) return value.map(normalizeValue).join(' | ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatDateTime(value: any) {
  if (!value) return '';
  if (typeof value === 'number') return new Date(value).toLocaleString('th-TH');
  if (typeof value?.toDate === 'function') return value.toDate().toLocaleString('th-TH');
  return String(value);
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_').slice(0, 80);
}

function safeSheetName(value: string) {
  return value.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet';
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
