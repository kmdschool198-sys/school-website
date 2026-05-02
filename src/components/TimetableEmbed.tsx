import { useEffect, useState } from 'react';
import { TIMETABLE_BACKUP } from '../data/timetableData';

const LS_KEY = 'timetable_v3_profiles';
const LS_ACTIVE = 'timetable_v3_active';

interface Props {
  height?: string;
  forceReseed?: boolean;
}

/**
 * Wraps the legacy timetable.html so it auto-loads bundled school data
 * (src/data/timetableData.ts) into localStorage on first visit.
 * The iframe shares the same origin → localStorage is shared.
 */
export default function TimetableEmbed({ height = '85vh', forceReseed = false }: Props) {
  const [ready, setReady] = useState(false);

  const seed = (overwrite: boolean) => {
    try {
      const existing = localStorage.getItem(LS_KEY);
      if (existing && !overwrite) return;

      const profiles = (TIMETABLE_BACKUP as any).profiles;
      if (!profiles) return;

      localStorage.setItem(LS_KEY, JSON.stringify(profiles));
      const activeNow = localStorage.getItem(LS_ACTIVE);
      if (!activeNow || overwrite) {
        const firstId = Object.keys(profiles)[0];
        if (firstId) localStorage.setItem(LS_ACTIVE, firstId);
      }
    } catch (e) {
      console.error('Timetable seed failed:', e);
    }
  };

  useEffect(() => {
    seed(forceReseed);
    setReady(true);
  }, [forceReseed]);

  const reseedNow = () => {
    if (!confirm('โหลดข้อมูลสำรองทับของเดิม? (การแก้ไขล่าสุดจะหายไป)')) return;
    seed(true);
    const f = document.getElementById('tt-iframe') as HTMLIFrameElement | null;
    if (f) f.src = f.src;
  };

  if (!ready) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FFF7ED', borderRadius: 16, color: '#7C2D12', fontWeight: 700,
      }}>
        ⏳ กำลังเตรียมข้อมูลตารางสอน...
      </div>
    );
  }

  return (
    <>
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #FFEDD5', background: 'white' }}>
        <iframe
          id="tt-iframe"
          src="/timetable.html"
          title="ตารางสอน"
          style={{ width: '100%', height, border: 0, display: 'block' }}
        />
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={reseedNow}
          style={{
            padding: '8px 14px', borderRadius: 10, border: '1px solid #FFEDD5',
            background: 'white', color: '#7C2D12', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
          }}
        >
          🔄 รีเซ็ตเป็นข้อมูลสำรองในระบบ
        </button>
      </div>
    </>
  );
}
