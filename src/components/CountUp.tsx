// ตัวเลขที่นับขึ้นเมื่อเลื่อนมาถึง เช่น 0 → 300+
// ถ้าค่าไม่ใช่ตัวเลข (เช่น "—" ตอนยังโหลดไม่เสร็จ) จะแสดงตามเดิมโดยไม่นับ
import { useEffect, useRef, useState } from 'react';

export default function CountUp({
  value,
  duration = 1400,
  className,
  style,
}: {
  value: string | number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const raw = String(value);
  const match = raw.match(/^(\D*)(\d+)(.*)$/);
  const target = match ? Number(match[2]) : null;

  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(target === null ? null : 0);

  useEffect(() => {
    if (target === null) return;
    const el = ref.current;
    if (!el) return;

    // ลดการเคลื่อนไหว หรือเบราว์เซอร์เก่า → แสดงเลขจริงทันที
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      setShown(target);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic — วิ่งเร็วตอนต้นแล้วค่อยๆ หยุด
          setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  if (target === null) {
    return <span ref={ref} className={className} style={style}>{raw}</span>;
  }

  return (
    <span ref={ref} className={className} style={style}>
      {match![1]}{(shown ?? 0).toLocaleString('th-TH')}{match![3]}
    </span>
  );
}
