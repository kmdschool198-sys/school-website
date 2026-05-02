import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { err: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State { return { err }; }

  componentDidCatch(err: Error, info: any) {
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', background: 'linear-gradient(135deg,#FFF7ED,#FFEDD5)',
      }}>
        <div style={{
          maxWidth: 520, background: 'white', borderRadius: 24, padding: '2rem',
          textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
          border: '1px solid #FFEDD5',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#FEF3C7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', color: '#D97706',
          }}>
            <AlertTriangle size={36} />
          </div>
          <h2 style={{ fontWeight: 900, color: '#0F172A', margin: '0 0 8px' }}>อุ๊ย! มีบางอย่างผิดพลาด</h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: 20 }}>
            หน้านี้โหลดไม่สำเร็จ — ลองกดโหลดใหม่ หรือกลับหน้าหลัก
          </p>
          {import.meta.env.DEV && (
            <pre style={{
              textAlign: 'left', background: '#F1F5F9', padding: 12, borderRadius: 10,
              fontSize: '0.72rem', color: '#DC2626', overflow: 'auto', maxHeight: 160,
              marginBottom: 20,
            }}>{this.state.err.message}{'\n'}{this.state.err.stack?.slice(0, 400)}</pre>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => location.reload()}
              style={{ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#FF6A01,#FB923C)', color: 'white',
                fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={14} />โหลดใหม่
            </button>
            <a href="/"
              style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid #E2E8F0',
                background: 'white', color: '#475569', fontWeight: 700, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Home size={14} />กลับหน้าหลัก
            </a>
          </div>
        </div>
      </div>
    );
  }
}
