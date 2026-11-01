// Lookup of a published result by student code + birth date (pure, no imports, so tests can load it).

export function normalizeResultCode(code: string): string {
  return code.trim();
}

/** "1/2/2555" or "01/02/2555" -> "01/02/2555" (day/month/Buddhist year); null when it is not a date */
export function normalizeBirthDate(value: string | undefined): string | null {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(value || '');
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2400) return null;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/**
 * Public result documents are found by student code AND birth date: the id is a SHA-256 of both,
 * so trying codes one after another (they run in order) never opens another child's results,
 * and the birth date itself is not stored anywhere public.
 */
export async function resultLookupDocId(announcementId: string, code: string, birthDate: string): Promise<string | null> {
  const birth = normalizeBirthDate(birthDate);
  const normalizedCode = normalizeResultCode(code);
  if (!birth || !normalizedCode) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${announcementId}|${normalizedCode}|${birth}`));
  const hex = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  return `${announcementId}__${hex.slice(0, 40)}`;
}
