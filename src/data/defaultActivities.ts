import type { Activity } from '../pages/Calendar';

// Color scheme
export const COLOR_HOLIDAY = '#EF4444';   // red - national/royal holidays
export const COLOR_TERM = '#A855F7';      // purple - school term boundaries
export const COLOR_BUDDHIST = '#F59E0B';  // amber - Buddhist holy days
export const COLOR_ACTIVITY = '#3B82F6';  // blue - school activities (default)

/**
 * Seed activities for academic year 2569 (May 2026 - Mar 2027)
 * Source: ปฏิทินนับวันเรียน ปีการศึกษา 2569 — สพป.กำแพงเพชร เขต 2
 */
export const DEFAULT_ACTIVITIES: Activity[] = [
  // ===== Term boundaries =====
  { id: 'd-open-1-69', date: '2026-05-18', title: 'เปิดภาคเรียนที่ 1/2569', isHoliday: false, color: COLOR_TERM, description: 'เริ่มต้นภาคเรียนที่ 1 ปีการศึกษา 2569' },
  { id: 'd-close-1-69', date: '2026-10-11', endDate: '2026-10-31', title: 'ปิดภาคเรียนที่ 1/2569', isHoliday: true, color: COLOR_TERM, description: 'ปิดภาคเรียนที่ 1 ปีการศึกษา 2569' },
  { id: 'd-open-2-69', date: '2026-11-01', title: 'เปิดภาคเรียนที่ 2/2569', isHoliday: false, color: COLOR_TERM, description: 'เริ่มต้นภาคเรียนที่ 2 ปีการศึกษา 2569' },
  { id: 'd-close-2-69', date: '2027-04-01', endDate: '2027-04-30', title: 'ปิดภาคเรียนที่ 2/2569', isHoliday: true, color: COLOR_TERM, description: 'ปิดภาคเรียนปลายปีการศึกษา 2569' },

  // ===== National & royal holidays (per official calendar) =====
  { id: 'h-vis-69', date: '2026-06-01', title: 'หยุดชดเชย วันวิสาขบูชา', isHoliday: true, color: COLOR_HOLIDAY },
  { id: 'h-queen-69', date: '2026-06-03', title: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี', isHoliday: true, color: COLOR_HOLIDAY },
  { id: 'h-king-69', date: '2026-07-28', title: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว ร.10', isHoliday: true, color: COLOR_HOLIDAY },
  { id: 'h-asarn-69', date: '2026-07-29', title: 'วันอาสาฬหบูชา', isHoliday: true, color: COLOR_BUDDHIST, description: 'วันที่พระพุทธเจ้าแสดงปฐมเทศนา' },
  { id: 'h-khao-69', date: '2026-07-30', title: 'วันเข้าพรรษา', isHoliday: true, color: COLOR_BUDDHIST, description: 'พระสงฆ์เริ่มจำพรรษา 3 เดือน' },
  { id: 'h-mom-69', date: '2026-08-12', title: 'วันแม่แห่งชาติ', isHoliday: true, color: COLOR_HOLIDAY, description: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง' },
  { id: 'h-r9-69', date: '2026-10-13', title: 'วันนวมินทรมหาราช', isHoliday: true, color: COLOR_HOLIDAY, description: 'วันคล้ายวันสวรรคต ร.9' },
  { id: 'h-r5-69', date: '2026-10-23', title: 'วันปิยมหาราช', isHoliday: true, color: COLOR_HOLIDAY, description: 'วันคล้ายวันสวรรคต ร.5' },
  { id: 'h-dad-69', date: '2026-12-07', title: 'หยุดชดเชย วันพ่อแห่งชาติ', isHoliday: true, color: COLOR_HOLIDAY, description: 'วันคล้ายวันพระบรมราชสมภพ ร.9' },
  { id: 'h-cons-69', date: '2026-12-10', title: 'วันรัฐธรรมนูญ', isHoliday: true, color: COLOR_HOLIDAY },
  { id: 'h-eve-69', date: '2026-12-31', title: 'วันสิ้นปี', isHoliday: true, color: COLOR_HOLIDAY },
  { id: 'h-ny-70', date: '2027-01-01', title: 'วันขึ้นปีใหม่', isHoliday: true, color: COLOR_HOLIDAY },
  { id: 'h-tch-70', date: '2027-01-16', title: 'วันครู', isHoliday: true, color: COLOR_HOLIDAY, description: 'หยุดเฉพาะครู — งานวันครู' },
  { id: 'h-makha-70', date: '2027-02-22', title: 'หยุดชดเชย วันมาฆบูชา', isHoliday: true, color: COLOR_BUDDHIST },

  // ===== Major Buddhist holy days =====
  { id: 'b-vis-69', date: '2026-05-31', title: 'วันวิสาขบูชา', isHoliday: true, color: COLOR_BUDDHIST, description: 'วันประสูติ ตรัสรู้ ปรินิพพานของพระพุทธเจ้า' },
  { id: 'b-out-69', date: '2026-10-26', title: 'วันออกพรรษา', isHoliday: false, color: COLOR_BUDDHIST, description: 'พระสงฆ์ออกจากการจำพรรษา' },
  { id: 'b-loy-69', date: '2026-11-24', title: 'วันลอยกระทง', isHoliday: false, color: COLOR_BUDDHIST },
  { id: 'b-makha-70', date: '2027-02-21', title: 'วันมาฆบูชา', isHoliday: true, color: COLOR_BUDDHIST, description: 'จาตุรงคสันนิบาต — พระสงฆ์ 1,250 รูปมาประชุมโดยมิได้นัดหมาย' },

  // ===== วันพระ (Buddhist sabbath days) — academic year 2569 =====
  // พฤษภาคม 2569
  { id: 'wp-2026-05-22', date: '2026-05-22', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 7)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-05-30', date: '2026-05-30', title: 'วันพระ (ขึ้น 15 ค่ำ เดือน 7)', color: COLOR_BUDDHIST },
  // มิถุนายน
  { id: 'wp-2026-06-06', date: '2026-06-06', title: 'วันพระ (แรม 8 ค่ำ เดือน 7)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-06-13', date: '2026-06-13', title: 'วันพระ (แรม 15 ค่ำ เดือน 7)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-06-21', date: '2026-06-21', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 8)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-06-28', date: '2026-06-28', title: 'วันพระ (ขึ้น 15 ค่ำ เดือน 8)', color: COLOR_BUDDHIST },
  // กรกฎาคม
  { id: 'wp-2026-07-06', date: '2026-07-06', title: 'วันพระ (แรม 8 ค่ำ เดือน 8)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-07-13', date: '2026-07-13', title: 'วันพระ (แรม 15 ค่ำ เดือน 8)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-07-21', date: '2026-07-21', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 9)', color: COLOR_BUDDHIST },
  // 29 ก.ค. = อาสาฬหบูชา (ขึ้น 15 ค่ำ เดือน 8 หลัง — ปี 2569 เป็นอธิกมาส)
  // สิงหาคม
  { id: 'wp-2026-08-05', date: '2026-08-05', title: 'วันพระ (แรม 8 ค่ำ เดือน 9)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-08-12b', date: '2026-08-12', title: 'วันพระ (แรม 15 ค่ำ เดือน 9)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-08-20', date: '2026-08-20', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 10)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-08-27', date: '2026-08-27', title: 'วันพระ (ขึ้น 15 ค่ำ เดือน 10)', color: COLOR_BUDDHIST },
  // กันยายน
  { id: 'wp-2026-09-04', date: '2026-09-04', title: 'วันพระ (แรม 8 ค่ำ เดือน 10)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-09-11', date: '2026-09-11', title: 'วันพระ (แรม 15 ค่ำ เดือน 10)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-09-19', date: '2026-09-19', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 11)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-09-26', date: '2026-09-26', title: 'วันพระ (ขึ้น 15 ค่ำ เดือน 11)', color: COLOR_BUDDHIST },
  // ตุลาคม
  { id: 'wp-2026-10-04', date: '2026-10-04', title: 'วันพระ (แรม 8 ค่ำ เดือน 11)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-10-11', date: '2026-10-11', title: 'วันพระ (แรม 15 ค่ำ เดือน 11)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-10-19', date: '2026-10-19', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 12)', color: COLOR_BUDDHIST },
  // 26 ต.ค. = วันออกพรรษา
  // พฤศจิกายน
  { id: 'wp-2026-11-02', date: '2026-11-02', title: 'วันพระ (แรม 8 ค่ำ เดือน 12)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-11-09', date: '2026-11-09', title: 'วันพระ (แรม 15 ค่ำ เดือน 12)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-11-17', date: '2026-11-17', title: 'วันพระ (ขึ้น 8 ค่ำ เดือนอ้าย)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-11-24b', date: '2026-11-24', title: 'วันพระ (ขึ้น 15 ค่ำ เดือนอ้าย)', color: COLOR_BUDDHIST },
  // ธันวาคม
  { id: 'wp-2026-12-02', date: '2026-12-02', title: 'วันพระ (แรม 8 ค่ำ เดือนอ้าย)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-12-09', date: '2026-12-09', title: 'วันพระ (แรม 15 ค่ำ เดือนอ้าย)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-12-17', date: '2026-12-17', title: 'วันพระ (ขึ้น 8 ค่ำ เดือนยี่)', color: COLOR_BUDDHIST },
  { id: 'wp-2026-12-24', date: '2026-12-24', title: 'วันพระ (ขึ้น 15 ค่ำ เดือนยี่)', color: COLOR_BUDDHIST },
  // มกราคม 2570
  { id: 'wp-2027-01-01b', date: '2027-01-01', title: 'วันพระ (แรม 8 ค่ำ เดือนยี่)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-01-08', date: '2027-01-08', title: 'วันพระ (แรม 15 ค่ำ เดือนยี่)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-01-15', date: '2027-01-15', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 3)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-01-22', date: '2027-01-22', title: 'วันพระ (ขึ้น 15 ค่ำ เดือน 3)', color: COLOR_BUDDHIST },
  // กุมภาพันธ์
  { id: 'wp-2027-01-30', date: '2027-01-30', title: 'วันพระ (แรม 8 ค่ำ เดือน 3)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-02-06', date: '2027-02-06', title: 'วันพระ (แรม 15 ค่ำ เดือน 3)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-02-14', date: '2027-02-14', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 4)', color: COLOR_BUDDHIST },
  // 21 ก.พ. = มาฆบูชา
  // มีนาคม
  { id: 'wp-2027-03-01', date: '2027-03-01', title: 'วันพระ (แรม 8 ค่ำ เดือน 4)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-03-08', date: '2027-03-08', title: 'วันพระ (แรม 15 ค่ำ เดือน 4)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-03-15', date: '2027-03-15', title: 'วันพระ (ขึ้น 8 ค่ำ เดือน 5)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-03-22', date: '2027-03-22', title: 'วันพระ (ขึ้น 15 ค่ำ เดือน 5)', color: COLOR_BUDDHIST },
  { id: 'wp-2027-03-30', date: '2027-03-30', title: 'วันพระ (แรม 8 ค่ำ เดือน 5)', color: COLOR_BUDDHIST },
];
