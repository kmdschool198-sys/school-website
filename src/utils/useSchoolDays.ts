import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SCHOOL_CALENDAR_COLLECTION, type SchoolDayOverride } from '../data/schoolCalendar';
import { DEFAULT_ACTIVITIES } from '../data/defaultActivities';
import { holidayDates } from './dates';

/**
 * Holidays (activities with isHoliday) and open/close overrides (school_calendar), the two
 * inputs resolveSchoolDay() needs. Shared so every page and report agrees on which days count.
 */
export function useSchoolDays() {
  // the built-in calendar (term breaks, public holidays) counts until Firestore loads or overrides an entry
  const [holidays, setHolidays] = useState<Record<string, string>>(() => holidayDates(DEFAULT_ACTIVITIES));
  const [schoolDays, setSchoolDays] = useState<Record<string, SchoolDayOverride>>({});

  useEffect(() => {
    return onSnapshot(collection(db, 'activities'), snap => {
      const saved = snap.docs.map(d => ({ id: d.id, ...(d.data() as { isHoliday?: boolean; date?: string; endDate?: string; title?: string }) }));
      const ids = new Set(saved.map(a => a.id));
      setHolidays(holidayDates([...DEFAULT_ACTIVITIES.filter(a => !ids.has(a.id)), ...saved]));
    }, () => setHolidays(holidayDates(DEFAULT_ACTIVITIES)));
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
