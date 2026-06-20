export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = CsvCell[];

export const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

export function downloadCsvReport(fileName: string, rows: CsvRow[]) {
  const csv = '\ufeff' + rows.map(row => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(fileName)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function makeReportRows(input: {
  title: string;
  subtitle?: string;
  meta?: CsvRow[];
  headers: CsvRow;
  rows: CsvRow[];
  footerRows?: CsvRow[];
}) {
  return [
    [input.title],
    ...(input.subtitle ? [[input.subtitle]] : []),
    ...(input.meta || []),
    [],
    input.headers,
    ...input.rows,
    ...(input.footerRows?.length ? [[], ...input.footerRows] : []),
  ];
}

export function makeSectionedReportRows(input: {
  title: string;
  subtitle?: string;
  meta?: CsvRow[];
  sections: Array<{
    title: string;
    headers: CsvRow;
    rows: CsvRow[];
    footerRows?: CsvRow[];
  }>;
  footerRows?: CsvRow[];
}) {
  const rows: CsvRow[] = [
    [input.title],
    ...(input.subtitle ? [[input.subtitle]] : []),
    ...(input.meta || []),
  ];

  input.sections.forEach((section, index) => {
    rows.push([]);
    if (index > 0) rows.push([]);
    rows.push([section.title]);
    rows.push(section.headers);
    rows.push(...section.rows);
    if (section.footerRows?.length) rows.push(...section.footerRows);
  });

  if (input.footerRows?.length) rows.push([], ...input.footerRows);
  return rows;
}

export function monthLabel(month: string) {
  const [year, monthText] = month.split('-').map(Number);
  return `${THAI_MONTHS_FULL[monthText - 1] || monthText} พ.ศ. ${year + 543}`;
}

export function yearLabel(year: string | number) {
  const value = Number(year);
  return `ปี พ.ศ. ${value + 543}`;
}

export function daysInMonth(month: string) {
  const [year, monthText] = month.split('-').map(Number);
  const lastDay = new Date(year, monthText, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => i + 1);
}

export function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_').slice(0, 140);
}

function escapeCsvCell(value: CsvCell) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
