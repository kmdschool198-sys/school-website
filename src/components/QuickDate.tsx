// Reusable date picker with quick "today/yesterday/-7d" buttons
import { Calendar } from 'lucide-react';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shiftDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtThai = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
};

export default function QuickDate({ value, onChange, max, label = 'วันที่', color = '#FF6A01' }: {
  value: string; onChange: (v: string) => void; max?: string; label?: string; color?: string;
}) {
  const today = todayStr();
  const yesterday = shiftDays(-1);
  const isToday = value === today;
  const isYesterday = value === yesterday;

  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', color: '#64748B', marginBottom: 4, fontWeight: 700 }}>
        <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {label}
      </label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={value} max={max} onChange={e => onChange(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: '0.9rem' }} />
        <button onClick={() => onChange(today)} style={pill(isToday, color)}>วันนี้</button>
        <button onClick={() => onChange(yesterday)} style={pill(isYesterday, color)}>เมื่อวาน</button>
        <button onClick={() => onChange(shiftDays(-7))} style={pill(value === shiftDays(-7), color)}>−7 วัน</button>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 4 }}>{fmtThai(value)}</div>
    </div>
  );
}

const pill = (active: boolean, color: string): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
  background: active ? color : '#F1F5F9',
  color: active ? 'white' : '#475569',
  fontSize: '0.78rem', fontWeight: 800,
});
