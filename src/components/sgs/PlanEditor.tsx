import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import type { ScoreScheme } from '../../data/academicData';
import {
  MAX_INDICATORS_PER_HALF, courseworkFull, emptyTermPlan, planErrors, termCount,
  type SubjectPlan, type TermPlan,
} from '../../utils/assessment';

// "ตั้งคะแนนเต็มรายวิชา" (SGS): full marks of S1-S9, กลางภาค, S10-S18 and ปลายภาค.
// Indicators + midterm must add up to the level's coursework share (มัธยม 70, ประถม 35 per term).
export default function PlanEditor({ title, scheme, plan, onSave, onClose }: {
  title: string;
  scheme: ScoreScheme;
  plan?: SubjectPlan;
  onSave: (plan: SubjectPlan) => Promise<void> | void;
  onClose: () => void;
}) {
  const terms = termCount(scheme);
  const [draft, setDraft] = useState<SubjectPlan>(() =>
    Array.from({ length: terms }, (_, i) => plan?.[i] ? { ...plan[i], final: scheme.finalMax } : emptyTermPlan(scheme)));
  const [term, setTerm] = useState(0);
  const [saving, setSaving] = useState(false);
  const tp = draft[term];
  const errors = draft.flatMap((p, i) => planErrors(p, scheme).map(e => (terms > 1 ? `ภาค ${i + 1}: ${e}` : e)));

  const update = (change: Partial<TermPlan>) => setDraft(d => d.map((p, i) => (i === term ? { ...p, ...change } : p)));
  const setMark = (half: 'before' | 'after', i: number, v: number) => update({ [half]: tp[half].map((x, k) => (k === i ? v : x)) });
  const addIndicator = (half: 'before' | 'after') => tp[half].length < MAX_INDICATORS_PER_HALF && update({ [half]: [...tp[half], 10] });
  const removeIndicator = (half: 'before' | 'after') => update({ [half]: tp[half].slice(0, -1) });

  const save = async () => {
    setSaving(true);
    try { await onSave(draft); onClose(); } finally { setSaving(false); }
  };

  const half = (key: 'before' | 'after', label: string, offset: number) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <b style={{ fontSize: '0.9rem' }}>{label}</b>
        <span style={{ fontSize: '0.78rem', color: '#64748B' }}>({tp[key].length}/{MAX_INDICATORS_PER_HALF} ช่อง)</span>
        <button type="button" onClick={() => removeIndicator(key)} disabled={!tp[key].length} style={iconBtn} aria-label={`ลบช่อง${label}`}><Minus size={14} /></button>
        <button type="button" onClick={() => addIndicator(key)} disabled={tp[key].length >= MAX_INDICATORS_PER_HALF} style={iconBtn} aria-label={`เพิ่มช่อง${label}`}><Plus size={14} /></button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tp[key].map((v, i) => (
          <label key={i} style={{ display: 'grid', gap: 2, fontSize: '0.75rem', color: '#475569', textAlign: 'center' }}>
            S{offset + i + 1}
            <input type="number" min={1} value={v} onChange={e => setMark(key, i, Number(e.target.value))} style={numInput} />
          </label>
        ))}
        {!tp[key].length && <span style={{ fontSize: '0.8rem', color: '#64748B' }}>ไม่มี — กด + เพื่อเพิ่มตัวชี้วัด</span>}
      </div>
    </div>
  );

  const cw = courseworkFull(tp);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={backdrop} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, flex: 1 }}>{title}</h3>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="ปิด"><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#475569' }}>
          ตัวชี้วัด + กลางภาค ต้องรวมได้ <b>{scheme.courseworkMax}</b> และปลายภาค <b>{scheme.finalMax}</b> (รวม {scheme.courseworkMax + scheme.finalMax}
          {scheme.yearly ? ' ต่อภาค · 2 ภาครวม 100' : ''}) · กรอกคะแนนเกินคะแนนเต็มไม่ได้
        </p>

        {terms > 1 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {draft.map((_, i) => (
              <button key={i} type="button" onClick={() => setTerm(i)} aria-pressed={term === i}
                style={{ ...tabBtn, background: term === i ? '#0369A1' : '#F1F5F9', color: term === i ? 'white' : '#0F172A' }}>
                ภาคเรียนที่ {i + 1}
              </button>
            ))}
          </div>
        )}

        {half('before', 'ตัวชี้วัดก่อนกลางภาค', 0)}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '0.9rem', fontWeight: 700 }}>
          กลางภาค (0 = ไม่สอบกลางภาค)
          <input type="number" min={0} value={tp.midterm} onChange={e => update({ midterm: Number(e.target.value) })} style={numInput} />
        </label>
        {half('after', 'ตัวชี้วัดหลังกลางภาค', MAX_INDICATORS_PER_HALF)}
        <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>ปลายภาค: {scheme.finalMax}</div>

        <div style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 12, background: errors.length ? '#FEF2F2' : '#F0FDF4', color: errors.length ? '#991B1B' : '#166534', fontSize: '0.85rem' }}>
          ระหว่างเรียนภาคนี้รวม <b>{cw}</b> / {scheme.courseworkMax}
          {errors.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{errors.map(e => <li key={e}>{e}</li>)}</ul>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ ...tabBtn, background: '#F1F5F9' }}>ยกเลิก</button>
          <button type="button" onClick={save} disabled={errors.length > 0 || saving}
            style={{ ...tabBtn, background: errors.length ? '#94A3B8' : '#0369A1', color: 'white' }}>
            {saving ? 'กำลังบันทึก…' : 'บันทึกคะแนนเต็ม'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const panel: React.CSSProperties = { background: 'white', borderRadius: 16, padding: '18px 20px', width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' };
const numInput: React.CSSProperties = { width: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid #CBD5E1', textAlign: 'center', fontWeight: 800 };
const iconBtn: React.CSSProperties = { border: '1px solid #CBD5E1', background: 'white', borderRadius: 8, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const tabBtn: React.CSSProperties = { border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 800, cursor: 'pointer' };
