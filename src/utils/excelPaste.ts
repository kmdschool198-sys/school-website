/**
 * Utilities for parsing tabular data copied from Microsoft Excel / Google Sheets
 * Upgraded with Gemini 4 Argon Architecture:
 * - Robust quoted multiline cell support (Alt+Enter in Excel)
 * - Thai numeral translation (๐-๙ -> 0-9) & unit filtering
 * - Smart student code/name matching vs sequential index matching
 * - Min/max range validation & warning flags
 */

export interface PasteColumnConfig {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface MatchedPasteRow {
  studentId: string;
  studentName: string;
  code?: string;
  matchType: 'code' | 'index';
  values: Record<string, number | null>;
  warnings: string[];
}

/**
 * Cleans and converts a raw cell string/number into a finite number or null.
 * Handles Thai digits (๐-๙), commas, units (กก., ซม., บาท), dashes (-), and empty cells.
 */
export function cleanNumeric(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return (Number.isFinite(raw) && !Number.isNaN(raw)) ? raw : null;
  }

  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  let str = String(raw).trim();
  if (!str || str === '-' || str === '—' || str === 'ขาด' || str === 'ลา' || str.toLowerCase() === 'n/a') {
    return null;
  }

  // Convert Thai numerals ๐-๙ to 0-9
  str = str.replace(/[๐-๙]/g, d => String(thaiDigits.indexOf(d)));

  // Remove commas, currency symbols, and common unit words
  str = str.replace(/,/g, '').replace(/฿|บาท|กก\.?|ซม\.?|ครั้ง|วัน|คะแนน|\s+/g, '');

  const match = str.match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  const num = parseFloat(match[0]);
  return (Number.isFinite(num) && !Number.isNaN(num)) ? num : null;
}

/**
 * Checks whether a paste event or string looks like a multi-cell Excel paste
 * (i.e. contains tabs or multiple lines).
 */
export function isTabularPaste(text: string): boolean {
  if (!text) return false;
  return text.includes('\t') || text.trim().includes('\n');
}

/**
 * Parses raw clipboard text into a 2D string matrix.
 * Supports tab-delimited columns (\t), quoted multiline cells with embedded newlines,
 * escaped double-quotes (""), and normalizes line endings (\r\n -> \n).
 */
export function parseClipboardTable(text: string): string[][] {
  if (!text || !text.trim()) return [];

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\t' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\n' && !inQuotes) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some(c => c !== '')) rows.push(currentRow);

  return rows;
}

/**
 * Detects whether the first row of a parsed table looks like a header row.
 * Returns true if row 0 has non-empty text cells that fail numeric conversion,
 * while row 1 contains valid numbers.
 */
export function isLikelyHeaderRow(table: string[][]): boolean {
  if (!table || table.length < 2) return false;
  const row0 = table[0];
  const row1 = table[1];

  const row0HasText = row0.some(cell => {
    const trimmed = cell.trim();
    return trimmed !== '' && cleanNumeric(trimmed) === null;
  });

  const row1HasNumber = row1.some(cell => cleanNumeric(cell) !== null);

  return row0HasText && row1HasNumber;
}

/**
 * Parses raw clipboard text into a 2D matrix of cleaned numbers (or null).
 */
export function parsePastedNumbers(text: string): (number | null)[][] {
  const table = parseClipboardTable(text);
  return table.map(row => row.map(cleanNumeric));
}

/**
 * Smart matching of pasted table rows to students:
 * - Automatically checks if column 0 contains Student Codes (e.g. DMC code or ID)
 * - If code matches are found (>= 2 students), uses Code-based matching (safe from sorting differences)
 * - Otherwise falls back to sequential row index matching
 * - Performs boundary validation (min/max) and generates warning alerts
 */
export function matchPastedRowsToStudents(
  rawRows: string[][],
  students: Array<{ id: string; code?: string; name: string }>,
  columns: PasteColumnConfig[]
): MatchedPasteRow[] {
  if (rawRows.length === 0 || students.length === 0) return [];

  const studentCodeSet = new Set(
    students.flatMap(s => [
      String(s.code || '').trim(),
      String(s.id || '').trim(),
    ]).filter(Boolean)
  );

  // Check if first column matches student codes
  const matchesInCol0 = rawRows.filter(r => r[0] && studentCodeSet.has(r[0].trim())).length;
  const isCodeMatch = matchesInCol0 >= Math.min(2, rawRows.length);

  const results: MatchedPasteRow[] = [];

  if (isCodeMatch) {
    for (const row of rawRows) {
      const codeOrId = row[0]?.trim();
      const targetStudent = students.find(s =>
        (s.code && String(s.code).trim() === codeOrId) ||
        (s.id && String(s.id).trim() === codeOrId)
      );
      if (!targetStudent) continue;

      // If column 1 is student name (non-numeric text), offset data columns by 2, else offset by 1
      const col1IsText = row.length > 2 && cleanNumeric(row[1]) === null;
      const startColIdx = col1IsText ? 2 : 1;

      const values: Record<string, number | null> = {};
      const warnings: string[] = [];

      columns.forEach((col, cIdx) => {
        const val = cleanNumeric(row[startColIdx + cIdx]);
        if (val !== null) {
          if (col.min !== undefined && val < col.min) {
            warnings.push(`${col.label} ต่ำกว่าเกณฑ์ (${val} < ${col.min})`);
          }
          if (col.max !== undefined && val > col.max) {
            warnings.push(`${col.label} เกินเกณฑ์สูงสุด (${val} > ${col.max})`);
          }
        }
        values[col.key] = val;
      });

      results.push({
        studentId: targetStudent.id,
        studentName: targetStudent.name,
        code: targetStudent.code,
        matchType: 'code',
        values,
        warnings,
      });
    }
  } else {
    // Index-based matching
    students.forEach((st, idx) => {
      const row = rawRows[idx];
      if (!row) return;

      const values: Record<string, number | null> = {};
      const warnings: string[] = [];

      columns.forEach((col, cIdx) => {
        const val = cleanNumeric(row[cIdx]);
        if (val !== null) {
          if (col.min !== undefined && val < col.min) {
            warnings.push(`${col.label} ต่ำกว่าเกณฑ์ (${val} < ${col.min})`);
          }
          if (col.max !== undefined && val > col.max) {
            warnings.push(`${col.label} เกินเกณฑ์สูงสุด (${val} > ${col.max})`);
          }
        }
        values[col.key] = val;
      });

      results.push({
        studentId: st.id,
        studentName: st.name,
        code: st.code,
        matchType: 'index',
        values,
        warnings,
      });
    });
  }

  return results;
}
