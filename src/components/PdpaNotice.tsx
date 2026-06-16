import { useEffect, useState, type ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

type PdpaNoticeProps = {
  title: string;
  children: ReactNode;
  consentKey?: string;
  checkboxLabel?: string;
  onAcceptedChange?: (accepted: boolean) => void;
};

export default function PdpaNotice({
  title,
  children,
  consentKey,
  checkboxLabel,
  onAcceptedChange,
}: PdpaNoticeProps) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const next = consentKey ? localStorage.getItem(consentKey) === 'accepted' : false;
    setAccepted(next);
    onAcceptedChange?.(next);
  }, [consentKey, onAcceptedChange]);

  const toggle = (next: boolean) => {
    setAccepted(next);
    if (consentKey) {
      if (next) localStorage.setItem(consentKey, 'accepted');
      else localStorage.removeItem(consentKey);
    }
    onAcceptedChange?.(next);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr)',
      gap: 12,
      padding: '1rem',
      borderRadius: 12,
      background: '#FFF7ED',
      border: '1px solid #FED7AA',
      borderLeft: '4px solid #FF6A01',
      color: '#7C2D12',
    }}>
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFEDD5',
        color: '#EA580C',
      }}>
        <ShieldCheck size={20} />
      </div>
      <div>
        <div style={{ fontWeight: 900, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.65 }}>{children}</div>
        {consentKey && checkboxLabel && (
          <label style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            marginTop: 10,
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={event => toggle(event.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>{checkboxLabel}</span>
          </label>
        )}
      </div>
    </div>
  );
}
