// School building inventory — for 3D model page
export type BuildingStatus = 'ดี' | 'พอใช้' | 'ทรุดโทรม';

export interface Building {
  id: string;
  category: string;          // ประเภทสิ่งปลูกสร้าง
  name: string;              // รูปแบบรายการ
  status: BuildingStatus;
  // visual
  wallColor: string;         // main wall color
  roofColor: string;         // roof color
  floors: 1 | 2;             // 1 or 2 stories
  width: number;             // relative width 1-3
  shape?: 'house' | 'long' | 'block';
}

export const BUILDINGS: Building[] = [
  // บ้านพักครู
  { id: 'th1', category: 'บ้านพักครู', name: 'อื่น ๆ (สร้างเอง)', status: 'พอใช้', wallColor: '#E8DCC4', roofColor: '#6B3410', floors: 2, width: 2, shape: 'house' },
  { id: 'th2', category: 'บ้านพักครู', name: 'บ้านพักครู 203/27', status: 'ดี', wallColor: '#DCD8C8', roofColor: '#C0392B', floors: 2, width: 2, shape: 'house' },
  { id: 'th3', category: 'บ้านพักครู', name: 'บ้านพักครู 205/26', status: 'ดี', wallColor: '#F0EDE5', roofColor: '#8B4513', floors: 2, width: 2, shape: 'house' },

  // บ้านพักนักเรียน
  { id: 'sh1', category: 'บ้านพักนักเรียน', name: 'กรมอาชีวะ', status: 'ทรุดโทรม', wallColor: '#D8D2C4', roofColor: '#8B7355', floors: 1, width: 3, shape: 'long' },
  { id: 'sh2', category: 'บ้านพักนักเรียน', name: 'กรมอาชีวะ', status: 'ทรุดโทรม', wallColor: '#9DB7D4', roofColor: '#7A8B99', floors: 1, width: 2, shape: 'long' },
  { id: 'sh3', category: 'บ้านพักนักเรียน', name: 'อื่น ๆ', status: 'ทรุดโทรม', wallColor: '#F5F5DC', roofColor: '#CD5C5C', floors: 1, width: 3, shape: 'long' },
  { id: 'sh4', category: 'บ้านพักนักเรียน', name: 'อื่น ๆ', status: 'ทรุดโทรม', wallColor: '#5F9EA0', roofColor: '#8B4513', floors: 1, width: 3, shape: 'long' },
  { id: 'sh5', category: 'บ้านพักนักเรียน', name: 'อาคารหอนอน', status: 'ทรุดโทรม', wallColor: '#F0E8D8', roofColor: '#8B4513', floors: 1, width: 3, shape: 'long' },

  // บ้านพักภารโรง
  { id: 'jh1', category: 'บ้านพักภารโรง', name: 'อื่น ๆ', status: 'ทรุดโทรม', wallColor: '#A0826D', roofColor: '#3E2723', floors: 2, width: 2, shape: 'house' },

  // ห้องน้ำห้องส้วม
  { id: 'tl1', category: 'ห้องน้ำห้องส้วม', name: 'สปช.601/26', status: 'ทรุดโทรม', wallColor: '#D4D4C4', roofColor: '#8B7355', floors: 1, width: 2, shape: 'long' },
  { id: 'tl2', category: 'ห้องน้ำห้องส้วม', name: 'สปช.601/26', status: 'พอใช้', wallColor: '#F0E8D8', roofColor: '#2E7D5A', floors: 1, width: 2, shape: 'long' },
  { id: 'tl3', category: 'ห้องน้ำห้องส้วม', name: 'อื่น ๆ', status: 'ดี', wallColor: '#4FA3D1', roofColor: '#2C5F7C', floors: 1, width: 2, shape: 'long' },

  // อาคารห้องสมุด
  { id: 'lb1', category: 'อาคารห้องสมุด', name: 'อื่น ๆ', status: 'พอใช้', wallColor: '#7BA7BC', roofColor: '#3D6B7A', floors: 1, width: 3, shape: 'long' },
  { id: 'lb2', category: 'อาคารห้องสมุด', name: 'อื่น ๆ', status: 'ดี', wallColor: '#FAF0E6', roofColor: '#8B4513', floors: 1, width: 2, shape: 'long' },

  // อาคารอเนกประสงค์
  { id: 'mp1', category: 'อาคารอเนกประสงค์', name: 'สปช. 203/26', status: 'ดี', wallColor: '#A8C09A', roofColor: '#556B4F', floors: 1, width: 3, shape: 'block' },

  // อาคารเรียน
  { id: 'cl1', category: 'อาคารเรียน', name: 'สปช.105/29', status: 'ดี', wallColor: '#B19CD9', roofColor: '#5D4E8C', floors: 2, width: 3, shape: 'block' },
  { id: 'cl2', category: 'อาคารเรียน', name: 'สปช.105/29', status: 'ดี', wallColor: '#5DADE2', roofColor: '#2E5F8A', floors: 2, width: 3, shape: 'block' },
  { id: 'cl3', category: 'อาคารเรียน', name: 'สปช.105/29', status: 'ดี', wallColor: '#3498DB', roofColor: '#1F618D', floors: 2, width: 3, shape: 'block' },
  { id: 'cl4', category: 'อาคารเรียน', name: 'อาคารอนุบาล', status: 'ดี', wallColor: '#FADBD8', roofColor: '#A93226', floors: 1, width: 3, shape: 'long' },

  // โรงอาหาร
  { id: 'cf1', category: 'โรงอาหาร', name: 'โรงอาหารแบบสร้างเอง', status: 'ดี', wallColor: '#5DADE2', roofColor: '#2C3E50', floors: 1, width: 3, shape: 'block' },
];

export const STATUS_COLOR: Record<BuildingStatus, string> = {
  'ดี': '#10B981',
  'พอใช้': '#F59E0B',
  'ทรุดโทรม': '#EF4444',
};

export const CATEGORY_ICON: Record<string, string> = {
  'บ้านพักครู': '🏡',
  'บ้านพักนักเรียน': '🏘️',
  'บ้านพักภารโรง': '🛖',
  'ห้องน้ำห้องส้วม': '🚻',
  'อาคารห้องสมุด': '📚',
  'อาคารอเนกประสงค์': '🏛️',
  'อาคารเรียน': '🏫',
  'โรงอาหาร': '🍽️',
};
