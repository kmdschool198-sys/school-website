// ─── Club / Activity / Scout attendance ───
export type ClubType = 'ชุมนุม' | 'ลูกเสือ-เนตรนารี' | 'กิจกรรมพัฒนาผู้เรียน' | 'อื่น ๆ';

export interface ClubMember {
  studentId: string;       // = student.id from roster
  code: string;            // เลขประจำตัว
  name: string;
  classLabel: string;      // ป.4/1, ม.2/1 ฯลฯ
}

export interface Club {
  id: string;
  name: string;            // ชื่อชุมนุม เช่น "ชุมนุมหมากรุก"
  type: ClubType;
  advisor: string;         // ครูที่ปรึกษา
  description?: string;
  members: ClubMember[];
  createdAt: number;
}

export type AttStatus = 'present' | 'absent' | 'leave';

export interface ClubAttendanceDoc {
  clubId: string;
  date: string;            // YYYY-MM-DD
  records: Record<string, { status: AttStatus; note?: string }>;
  updatedAt?: number;
}
