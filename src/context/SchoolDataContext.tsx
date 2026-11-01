import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useSchoolRoster, type UnifiedClassRoster } from '../utils/useSchoolRoster';
import { getCachedRoster, batchSaveClassRoster, getPrintHubCompositeData, type CompositePrintHubData } from '../services/firestoreService';
import { useSignedIn } from '../utils/useSignedIn';

interface SchoolDataContextType {
  classes: UnifiedClassRoster[];
  totalStudents: number;
  loading: boolean;
  refreshRoster: () => Promise<void>;
  updateRosterBatch: (nextClasses: any[]) => Promise<boolean>;
  getCompositePrintData: (classId: string, date: string) => Promise<CompositePrintHubData>;
}

const SchoolDataContext = createContext<SchoolDataContextType | undefined>(undefined);

export function SchoolDataProvider({ children }: { children: ReactNode }) {
  const { classes: dynamicClasses } = useSchoolRoster();
  const [cachedClasses, setCachedClasses] = useState<UnifiedClassRoster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const signedIn = useSignedIn();

  // Sync with initial cached rosters (staff data: never fetched for a visitor)
  useEffect(() => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const cached = await getCachedRoster();
        if (mounted && cached && cached.length > 0) {
          setCachedClasses(cached);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [signedIn]);

  // Use dynamicClasses as live source, fallback to cached
  const effectiveClasses = useMemo(() => {
    return dynamicClasses && dynamicClasses.length > 0 ? dynamicClasses : cachedClasses;
  }, [dynamicClasses, cachedClasses]);

  const totalStudents = useMemo(() => {
    return effectiveClasses.reduce((sum, c) => sum + (c.students?.length || 0), 0);
  }, [effectiveClasses]);

  const refreshRoster = async () => {
    setLoading(true);
    try {
      const fresh = await getCachedRoster(true);
      if (fresh) setCachedClasses(fresh);
    } finally {
      setLoading(false);
    }
  };

  const updateRosterBatch = async (nextClasses: any[]) => {
    const success = await batchSaveClassRoster(nextClasses);
    if (success) {
      await refreshRoster();
    }
    return success;
  };

  const getCompositePrintData = async (classId: string, date: string) => {
    return await getPrintHubCompositeData(classId, date);
  };

  const value = useMemo<SchoolDataContextType>(() => ({
    classes: effectiveClasses,
    totalStudents,
    loading,
    refreshRoster,
    updateRosterBatch,
    getCompositePrintData,
  }), [effectiveClasses, totalStudents, loading]);

  return (
    <SchoolDataContext.Provider value={value}>
      {children}
    </SchoolDataContext.Provider>
  );
}

export function useSchoolData() {
  const context = useContext(SchoolDataContext);
  if (!context) {
    throw new Error('useSchoolData must be used within a SchoolDataProvider');
  }
  return context;
}
