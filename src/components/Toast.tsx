import { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  show: boolean;
  onClose: () => void;
}

export default function Toast({ message, type, show, onClose }: ToastProps) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onClose, 3500);
      return () => clearTimeout(t);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '16px 24px', borderRadius: '16px',
      background: type === 'success'
        ? 'linear-gradient(135deg, #FF6A01, #FB923C)'
        : 'linear-gradient(135deg, #EF4444, #F87171)',
      color: 'white', fontWeight: 700, fontSize: '0.95rem',
      boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
      animation: 'toastIn 0.4s ease-out',
      backdropFilter: 'blur(10px)',
    }}>
      {type === 'success' ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
      {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginLeft: '8px' }}>
        <X size={18} />
      </button>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(80px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
