import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizeThaiName } from './studentKey';

// Staff records (personnel collection) are the key for everything a staff member does:
// leave, training, janitor work and duty. New records store the personnel doc id next to
// the name; older records only have the name, so matching falls back to the name.

export interface PersonnelRef {
  id: string;
  name: string;
  position?: string;
  category?: string;
  email?: string;
}

export function usePersonnel(category?: string): PersonnelRef[] {
  const [list, setList] = useState<PersonnelRef[]>([]);
  useEffect(() => onSnapshot(query(collection(db, 'personnel'), orderBy('order', 'asc')), snap => {
    const arr: PersonnelRef[] = [];
    snap.forEach(d => {
      const p = d.data() as Omit<PersonnelRef, 'id'>;
      if (p.name && (!category || p.category === category)) arr.push({ ...p, id: d.id });
    });
    setList(arr);
  }, () => setList([])), [category]);
  return list;
}

/** Personnel doc id for a typed or selected name ('' when the name is not in the register). */
export function personnelIdByName(list: PersonnelRef[], name?: string): string {
  const key = normalizeThaiName(name);
  return key ? (list.find(p => normalizeThaiName(p.name) === key)?.id || '') : '';
}

/** Same staff member: by personnel id when the record has one, otherwise by name. */
export function samePerson(rec: { id?: string; name?: string }, p: PersonnelRef): boolean {
  if (rec.id) return rec.id === p.id;
  return !!rec.name && normalizeThaiName(rec.name) === normalizeThaiName(p.name);
}
