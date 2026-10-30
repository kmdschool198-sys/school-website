import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SCHOOL_CALENDAR_COLLECTION, type SchoolDayOverride } from '../data/schoolCalendar';

/**
 * Holidays (activities with isHoliday) and open/close overrides (school_calendar), the two
 * inputs resolveSchoolDay() needs. Shared so every page and report agrees on which days count.
 */
export function useSchoolDays() {
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [schoolDays, setSchoolDays] = useState<Record<string, SchoolDayOverride>>({});

  useEffect(() => {
    return onSnapshot(collection(db, 'activities'), snap => {
      const map: Record<string, string> = {};
      snap.forEach(d => {
        const a = d.data() as { isHoliday?: boolean; date?: string; title?: string };
        if (a.isHoliday && a.date) map[a.date] = a.title || 'วันหยุด';
      });
      setHolidays(map);
    }, () => setHolidays({}));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, SCHOOL_CALENDAR_COLLECTION), snap => {
      const map: Record<string, SchoolDayOverride> = {};
      snap.forEach(d => { map[d.id] = { date: d.id, ...(d.data() as Omit<SchoolDayOverride, 'date'>) }; });
      setSchoolDays(map);
    }, () => setSchoolDays({}));
  }, []);

  return { holidays, schoolDays };
}
