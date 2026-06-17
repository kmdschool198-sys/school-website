import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2, RotateCcw } from 'lucide-react';

type PageStateProps = {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
};

export function PageLoading({
  title = 'กำลังโหลดข้อมูล',
  message = 'ระบบกำลังเตรียมข้อมูลให้พร้อมใช้งาน',
  compact = false,
}: PageStateProps) {
  return (
    <PageStateCard
      title={title}
      message={message}
      compact={compact}
      icon={<Loader2 size={compact ? 22 : 34} />}
      tone="loading"
    />
  );
}

export function PageEmpty({
  title = 'ยังไม่มีข้อมูล',
  message = 'เมื่อมีข้อมูลแล้ว ระบบจะแสดงรายการในส่วนนี้',
  action,
  compact = false,
}: PageStateProps) {
  return (
    <PageStateCard
      title={title}
      message={message}
      action={action}
      compact={compact}
      icon={<Inbox size={compact ? 22 : 34} />}
      tone="empty"
    />
  );
}

export function PageError({
  title = 'โหลดข้อมูลไม่สำเร็จ',
  message = 'กรุณาลองใหม่อีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ',
  action,
  compact = false,
  onRetry,
}: PageStateProps & { onRetry?: () => void }) {
  const retryAction = onRetry ? (
    <button type="button" onClick={onRetry} style={primaryButton}>
      <RotateCcw size={14} /> ลองใหม่
    </button>
  ) : null;

  return (
    <PageStateCard
      title={title}
      message={message}
      action={action || retryAction}
      compact={compact}
      icon={<AlertCircle size={compact ? 22 : 34} />}
      tone="error"
    />
  );
}

function PageStateCard({
  title,
  message,
  icon,
  action,
  compact,
  tone,
}: PageStateProps & { tone: 'loading' | 'empty' | 'error' }) {
  const palette = {
    loading: { bg: '#FFF7ED', fg: '#FF6A01', border: '#FED7AA' },
    empty: { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' },
    error: { bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA' },
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'loading' ? 'polite' : undefined}
      style={{
        background: 'white',
        border: `1px solid ${palette.border}`,
        borderRadius: compact ? 12 : 18,
        padding: compact ? '1rem' : '2rem',
        textAlign: 'center',
        color: '#64748B',
        boxShadow: compact ? 'none' : '0 8px 24px rgba(15,23,42,0.06)',
      }}
    >
      <div
        style={{
          width: compact ? 42 : 64,
          height: compact ? 42 : 64,
          borderRadius: '50%',
          margin: '0 auto 0.8rem',
          background: palette.bg,
          color: palette.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div style={{ fontWeight: 900, color: '#0F172A', fontSize: compact ? '0.95rem' : '1.15rem' }}>
        {title}
      </div>
      {message && (
        <div style={{ marginTop: 6, fontSize: compact ? '0.8rem' : '0.9rem', lineHeight: 1.6 }}>
          {message}
        </div>
      )}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  border: 'none',
  borderRadius: 10,
  background: 'linear-gradient(135deg,#FF6A01,#FB923C)',
  color: 'white',
  padding: '9px 14px',
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
};
