// แถบแสดงความคืบหน้าการอ่านด้านบน + ปุ่มกลับขึ้นบนพร้อมวงแหวนบอกตำแหน่ง
// ติดตั้งครั้งเดียวใน App ใช้ได้ทุกหน้า
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / max) * 100)) : 0);
    };
    // อ่านค่าตอนวาดภาพเท่านั้น กันการคำนวณรัวตอนเลื่อนเร็ว
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const show = pct > 6;
  const ring = 2 * Math.PI * 20; // รัศมี 20

  return (
    <>
      <div className="scroll-progress no-print" aria-hidden="true">
        <div className="scroll-progress-bar" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>

      <button
        type="button"
        className={`back-to-top no-print${show ? ' is-visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="กลับขึ้นด้านบน"
        title="กลับขึ้นด้านบน"
        tabIndex={show ? 0 : -1}
      >
        <svg viewBox="0 0 44 44" className="back-to-top-ring" aria-hidden="true">
          <circle cx="22" cy="22" r="20" className="ring-track" />
          <circle
            cx="22" cy="22" r="20"
            className="ring-value"
            style={{ strokeDasharray: ring, strokeDashoffset: ring * (1 - pct / 100) }}
          />
        </svg>
        <ArrowUp size={18} />
      </button>
    </>
  );
}
