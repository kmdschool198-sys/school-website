// Global toast notification system (singleton) — call toast.success() / toast.error() anywhere
import { useEffect, useState } from 'react';

type Variant = 'success' | 'error' | 'info' | 'warn';
interface ToastItem { id: number; message: string; variant: Variant; }

let _id = 0;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function notify() { listeners.forEach(l => l(items)); }

function push(message: string, variant: Variant) {
  const item = { id: ++_id, message, variant };
  items = [...items, item];
  notify();
  setTimeout(() => {
    items = items.filter(x => x.id !== item.id);
    notify();
  }, variant === 'error' ? 6000 : 3500);
}

export const toast = {
  success: (msg: string) => push(msg, 'success'),
  error: (msg: string) => push(msg, 'error'),
  info: (msg: string) => push(msg, 'info'),
  warn: (msg: string) => push(msg, 'warn'),
};

const COLORS: Record<Variant, { bg: string; border: string; icon: string }> = {
  success: { bg: '#DCFCE7', border: '#10B981', icon: '✓' },
  error:   { bg: '#FEE2E2', border: '#EF4444', icon: '✕' },
  info:    { bg: '#DBEAFE', border: '#3B82F6', icon: 'ℹ' },
  warn:    { bg: '#FEF3C7', border: '#F59E0B', icon: '⚠' },
};

export default function GlobalToast() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => {
    listeners.add(setList);
    return () => { listeners.delete(setList); };
  }, []);

  if (list.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
    }}>
      {list.map(item => {
        const c = COLORS[item.variant];
        return (
          <div key={item.id} style={{
            background: c.bg, borderLeft: `4px solid ${c.border}`,
            padding: '12px 16px', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.92rem', fontWeight: 700, color: '#0F172A',
            animation: 'toastSlide 0.25s ease',
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', background: c.border, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, flexShrink: 0,
            }}>{c.icon}</span>
            <span style={{ flex: 1 }}>{item.message}</span>
            <button onClick={() => {
              items = items.filter(x => x.id !== item.id);
              notify();
            }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.2rem', color: '#64748B', padding: 0, lineHeight: 1,
            }}>×</button>
          </div>
        );
      })}
      <style>{`@keyframes toastSlide { from { transform: translateX(20px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
