import type { CSSProperties } from 'react';
import { DIRECTOR_NAME, DIRECTOR_POSITION } from '../../config/siteLinks';

// Values shared by the official print components (Official.tsx) and the pages that build
// printed tables. Kept apart from the components so React fast refresh keeps working.

export interface Signer {
  role: string;          // e.g. "ผู้บันทึก", "ผู้ตรวจสอบ"
  name?: string;         // blank line when unknown, filled in by hand
  position?: string;
}

export const DIRECTOR_SIGNER: Signer = { role: 'ผู้อำนวยการสถานศึกษา', name: DIRECTOR_NAME, position: DIRECTOR_POSITION };

/** Black-ruled table cell styles; use `shade` for cells that must stand out in black and white. */
export const officialTh: CSSProperties = {
  border: '1px solid #000', padding: '2px 4px', textAlign: 'center', fontWeight: 700, verticalAlign: 'middle',
};
export const officialTd: CSSProperties = {
  border: '1px solid #000', padding: '1px 4px', textAlign: 'center', verticalAlign: 'middle',
};
export const officialTdLeft: CSSProperties = { ...officialTd, textAlign: 'left' };
export const SHADE = '#D9D9D9';
