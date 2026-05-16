// ─── Generic teacher log system ───
// Each log type stores docs at: teacher_logs/{type}_{id}

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'url' | 'select';

export interface LogField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];          // for 'select'
  placeholder?: string;
}

export interface LogConfig {
  type: string;                // url slug
  title: string;
  emoji: string;
  color: string;               // primary color
  description: string;
  collection: string;          // Firestore collection name
  fields: LogField[];          // form fields
  listColumns: { key: string; label: string }[];   // table columns
}

const STD_FIELDS = {
  teacherName: { key: 'teacherName', label: 'ครูผู้บันทึก', type: 'text' as const, required: true, placeholder: 'ชื่อ-สกุล' },
  date: { key: 'date', label: 'วันที่', type: 'date' as const, required: true },
};

export const TEACHER_LOGS: Record<string, LogConfig> = {
  plc: {
    type: 'plc',
    title: 'บันทึก PLC',
    emoji: '👥',
    color: '#A855F7',
    description: 'บันทึกการประชุมชุมชนแห่งการเรียนรู้ทางวิชาชีพ (Professional Learning Community)',
    collection: 'log_plc',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'topic', label: 'หัวข้อ/ประเด็น PLC', type: 'text', required: true },
      { key: 'group', label: 'กลุ่ม PLC', type: 'text', placeholder: 'เช่น กลุ่มสาระคณิตศาสตร์' },
      { key: 'members', label: 'ผู้เข้าร่วม', type: 'textarea', placeholder: 'รายชื่อ คั่นด้วยจุลภาค' },
      { key: 'hours', label: 'จำนวนชั่วโมง', type: 'number' },
      { key: 'problem', label: 'ปัญหา/ประเด็นที่หารือ', type: 'textarea' },
      { key: 'solution', label: 'แนวทางแก้ไข/ผลที่ได้', type: 'textarea' },
      { key: 'attachmentUrl', label: 'ลิงก์เอกสาร/รูปภาพ (Google Drive)', type: 'url' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่' },
      { key: 'topic', label: 'หัวข้อ' },
      { key: 'teacherName', label: 'ผู้บันทึก' },
      { key: 'hours', label: 'ชั่วโมง' },
    ],
  },
  media: {
    type: 'media',
    title: 'บันทึกการใช้สื่อ',
    emoji: '📚',
    color: '#0EA5E9',
    description: 'บันทึกการใช้สื่อการสอนในห้องเรียน',
    collection: 'log_media',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'classLabel', label: 'ชั้นเรียน', type: 'text', required: true },
      { key: 'subject', label: 'รายวิชา', type: 'text', required: true },
      { key: 'mediaType', label: 'ประเภทสื่อ', type: 'select', options: ['สื่อสิ่งพิมพ์', 'สื่อดิจิทัล', 'สื่อของจริง', 'สื่อจำลอง', 'วิดีโอ', 'PowerPoint', 'เว็บไซต์', 'แอปพลิเคชัน', 'อื่น ๆ'] },
      { key: 'mediaName', label: 'ชื่อสื่อ/หัวข้อ', type: 'text', required: true },
      { key: 'objective', label: 'วัตถุประสงค์การใช้', type: 'textarea' },
      { key: 'result', label: 'ผลที่ได้/ข้อเสนอแนะ', type: 'textarea' },
      { key: 'attachmentUrl', label: 'ลิงก์สื่อ (Google Drive)', type: 'url' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่' },
      { key: 'classLabel', label: 'ชั้น' },
      { key: 'subject', label: 'วิชา' },
      { key: 'mediaName', label: 'ชื่อสื่อ' },
      { key: 'teacherName', label: 'ครู' },
    ],
  },
  saving: {
    type: 'saving',
    title: 'ระบบออมเงิน',
    emoji: '💰',
    color: '#10B981',
    description: 'บันทึกการออมเงินของนักเรียน',
    collection: 'log_saving',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'classLabel', label: 'ชั้นเรียน', type: 'text', required: true },
      { key: 'studentName', label: 'ชื่อนักเรียน', type: 'text', required: true },
      { key: 'studentCode', label: 'เลขประจำตัว', type: 'text' },
      { key: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', required: true },
      { key: 'balance', label: 'ยอดสะสมทั้งหมด (บาท)', type: 'number' },
      { key: 'note', label: 'หมายเหตุ', type: 'textarea' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่' },
      { key: 'classLabel', label: 'ชั้น' },
      { key: 'studentName', label: 'ชื่อนักเรียน' },
      { key: 'amount', label: 'ยอดออม' },
      { key: 'balance', label: 'สะสม' },
    ],
  },
  'lesson-plan': {
    type: 'lesson-plan',
    title: 'ระบบส่งแผนการสอน',
    emoji: '📋',
    color: '#94A3B8',
    description: 'อัปโหลดและส่งแผนการจัดการเรียนรู้',
    collection: 'log_lesson_plan',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'classLabel', label: 'ชั้นเรียน', type: 'text', required: true },
      { key: 'subject', label: 'รายวิชา', type: 'text', required: true },
      { key: 'unit', label: 'หน่วยการเรียนรู้', type: 'text', required: true },
      { key: 'lessonName', label: 'ชื่อแผน/เรื่อง', type: 'text', required: true },
      { key: 'periods', label: 'จำนวนคาบ', type: 'number' },
      { key: 'attachmentUrl', label: 'ลิงก์ไฟล์แผน (Google Drive)', type: 'url', required: true, placeholder: 'https://drive.google.com/...' },
      { key: 'note', label: 'หมายเหตุ', type: 'textarea' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่ส่ง' },
      { key: 'classLabel', label: 'ชั้น' },
      { key: 'subject', label: 'วิชา' },
      { key: 'lessonName', label: 'ชื่อแผน' },
      { key: 'teacherName', label: 'ครู' },
    ],
  },
  remedial: {
    type: 'remedial',
    title: 'บันทึกการสอนซ่อมเสริม',
    emoji: '👨‍🏫',
    color: '#F59E0B',
    description: 'บันทึกการสอนซ่อมเสริมนักเรียนที่เรียนช้า/อ่อน',
    collection: 'log_remedial',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'classLabel', label: 'ชั้นเรียน', type: 'text', required: true },
      { key: 'subject', label: 'รายวิชา', type: 'text', required: true },
      { key: 'studentList', label: 'รายชื่อนักเรียน (คั่นด้วยจุลภาค)', type: 'textarea', required: true },
      { key: 'topic', label: 'เรื่อง/ทักษะที่ซ่อม', type: 'text', required: true },
      { key: 'hours', label: 'จำนวนชั่วโมง', type: 'number' },
      { key: 'method', label: 'วิธีการสอน', type: 'textarea' },
      { key: 'result', label: 'ผลการสอน/พัฒนาการ', type: 'textarea' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่' },
      { key: 'classLabel', label: 'ชั้น' },
      { key: 'subject', label: 'วิชา' },
      { key: 'topic', label: 'เรื่อง' },
      { key: 'teacherName', label: 'ครู' },
    ],
  },
  project: {
    type: 'project',
    title: 'รายงานโครงการ',
    emoji: '📊',
    color: '#EF4444',
    description: 'รายงานความก้าวหน้าโครงการ/กิจกรรม',
    collection: 'log_project',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'projectName', label: 'ชื่อโครงการ', type: 'text', required: true },
      { key: 'fiscalYear', label: 'ปีงบประมาณ', type: 'text', placeholder: 'เช่น 2569' },
      { key: 'budget', label: 'งบประมาณ (บาท)', type: 'number' },
      { key: 'spent', label: 'ใช้ไปแล้ว (บาท)', type: 'number' },
      { key: 'progress', label: 'ความก้าวหน้า (%)', type: 'number' },
      { key: 'status', label: 'สถานะ', type: 'select', options: ['ยังไม่เริ่ม', 'กำลังดำเนินการ', 'เสร็จสิ้น', 'ชะลอ', 'ยกเลิก'] },
      { key: 'result', label: 'ผลการดำเนินงาน', type: 'textarea' },
      { key: 'problem', label: 'ปัญหา/อุปสรรค', type: 'textarea' },
      { key: 'attachmentUrl', label: 'ลิงก์เอกสาร (Drive)', type: 'url' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่' },
      { key: 'projectName', label: 'โครงการ' },
      { key: 'status', label: 'สถานะ' },
      { key: 'progress', label: '%' },
      { key: 'teacherName', label: 'ผู้รับผิดชอบ' },
    ],
  },
  'body-metrics': {
    type: 'body-metrics',
    title: 'บันทึกน้ำหนัก-ส่วนสูง',
    emoji: '⚖️',
    color: '#EC4899',
    description: 'บันทึกน้ำหนัก ส่วนสูง และค่า BMI ของนักเรียน',
    collection: 'log_body_metrics',
    fields: [
      STD_FIELDS.teacherName,
      STD_FIELDS.date,
      { key: 'classLabel', label: 'ชั้นเรียน', type: 'text', required: true },
      { key: 'studentName', label: 'ชื่อนักเรียน', type: 'text', required: true },
      { key: 'studentCode', label: 'เลขประจำตัว', type: 'text' },
      { key: 'weight', label: 'น้ำหนัก (กก.)', type: 'number', required: true },
      { key: 'height', label: 'ส่วนสูง (ซม.)', type: 'number', required: true },
      { key: 'bmi', label: 'BMI (คำนวณ)', type: 'number' },
      { key: 'status', label: 'สถานะ', type: 'select', options: ['ผอม', 'ค่อนข้างผอม', 'สมส่วน', 'ท้วม', 'อ้วน'] },
      { key: 'note', label: 'หมายเหตุ', type: 'textarea' },
    ],
    listColumns: [
      { key: 'date', label: 'วันที่' },
      { key: 'classLabel', label: 'ชั้น' },
      { key: 'studentName', label: 'นักเรียน' },
      { key: 'weight', label: 'น้ำหนัก' },
      { key: 'height', label: 'ส่วนสูง' },
      { key: 'bmi', label: 'BMI' },
    ],
  },
};
