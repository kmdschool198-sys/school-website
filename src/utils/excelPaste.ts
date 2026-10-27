/**
 * Utilities for parsing tabular data copied from Microsoft Excel / Google Sheets
 */

/**
 * Parses raw clipboard text into a 2D string matrix.
 * Supports tab-delimited columns (\t) and newline-delimited rows (\r\n or \n).
 * Also strips surrounding quotes from Excel.
 */
export function parseClipboardTable(text: string): string[][] {
  if (!text) return [];

  // Normalize line breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // If the last line is completely empty (Excel adds trailing newline), remove it
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.map(line => {
    // If copied from Excel/Sheets, cells in a row are tab-delimited
    const cells = line.split('\t');
    return cells.map(cell => {
      let cleaned = cell.trim();
      // Unquote if cell was wrapped in quotes (e.g., "1,200.50")
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1).trim();
      }
      return cleaned;
    });
  });
}

/**
 * Cleans and converts a raw cell string into a finite number or null.
 * Handles Thai digits (๐-๙), Thai currency symbols (฿, บาท), commas (1,200.5), dashes (-), and empty cells.
 */
export function cleanNumeric(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s.toLowerCase() === 'n/a') return null;

  // Convert Thai numerals ๐-๙ to Arabic digits 0-9
  s = s.replace(/[๐-๙]/g, d => String(d.charCodeAt(0) - 3664));

  // Remove commas, currency symbols, and whitespace
  s = s.replace(/,/g, '').replace(/[฿บาท\s]/g, '');

  const num = Number(s);
  return (Number.isFinite(num) && !Number.isNaN(num)) ? num : null;
}

/**
 * Parses raw clipboard text into a 2D matrix of cleaned numbers (or null).
 */
export function parsePastedNumbers(text: string): (number | null)[][] {
  const table = parseClipboardTable(text);
  return table.map(row => row.map(cleanNumeric));
}

/**
 * Checks whether a paste event or string looks like a multi-cell Excel paste
 * (i.e. contains tabs or multiple lines).
 */
export function isTabularPaste(text: string): boolean {
  return text.includes('\t') || text.includes('\n');
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
