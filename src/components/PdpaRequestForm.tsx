import { useState, type CSSProperties, type FormEvent } from 'react';
import { Send, ShieldCheck } from 'lucide-react';
import { createPdpaRequest, type PdpaRequestType } from '../utils/pdpaAudit';

const requestTypes: { value: PdpaRequestType; label: string }[] = [
  { value: 'access', label: 'ขอเข้าถึง/ขอสำเนาข้อมูล' },
  { value: 'correct', label: 'ขอแก้ไขข้อมูล' },
  { value: 'delete', label: 'ขอลบ/ระงับใช้ข้อมูล' },
  { value: 'withdraw', label: 'ถอนความยินยอม' },
  { value: 'breach', label: 'แจ้งเหตุละเมิดข้อมูล' },
  { value: 'complaint', label: 'ร้องเรียนการใช้ข้อมูล' },
  { value: 'other', label: 'เรื่องอื่น ๆ' },
];

export default function PdpaRequestForm() {
  const [type, setType] = useState<PdpaRequestType>('access');
  const [requesterName, setRequesterName] = useState('');
  const [contact, setContact] = useState('');
  const [relation, setRelation] = useState('');
  const [detail, setDetail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    try {
      await createPdpaRequest({ type, requesterName, contact, relation, detail });
      setRequesterName('');
      setContact('');
      setRelation('');
      setDetail('');
      setType('access');
      setStatus('done');
    } catch (error) {
      console.error('PDPA request submit failed', error);
      setStatus('error');
    }
  };

  return (
    <form onSubmit={submit} style={{
      display: 'grid',
      gap: 14,
      padding: '1.25rem',
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: '#FFF7ED',
          color: '#FF6A01',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ShieldCheck size={20} />
        </span>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>ส่งคำขอเกี่ยวกับข้อมูลส่วนบุคคล</h3>
          <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.88rem', lineHeight: 1.6 }}>
            กรอกเท่าที่จำเป็น โรงเรียนจะใช้ข้อมูลในฟอร์มนี้เพื่อรับเรื่อง ตรวจสอบตัวตน และติดตามคำขอเท่านั้น
          </p>
        </div>
      </div>

      <div style={grid}>
        <label style={label}>
          ประเภทคำขอ
          <select value={type} onChange={event => setType(event.target.value as PdpaRequestType)} style={input} required>
            {requestTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label style={label}>
          ชื่อผู้ติดต่อ
          <input value={requesterName} onChange={event => setRequesterName(event.target.value)} style={input} maxLength={120} required />
        </label>
        <label style={label}>
          ช่องทางติดต่อกลับ
          <input value={contact} onChange={event => setContact(event.target.value)} style={input} maxLength={160} placeholder="เบอร์โทรหรืออีเมล" required />
        </label>
        <label style={label}>
          ความเกี่ยวข้อง
          <input value={relation} onChange={event => setRelation(event.target.value)} style={input} maxLength={120} placeholder="นักเรียน / ผู้ปกครอง / ครู / อื่น ๆ" required />
        </label>
      </div>

      <label style={label}>
        รายละเอียดคำขอ
        <textarea
          value={detail}
          onChange={event => setDetail(event.target.value)}
          style={{ ...input, minHeight: 110, resize: 'vertical' }}
          maxLength={1200}
          placeholder="หลีกเลี่ยงการใส่ข้อมูลอ่อนไหวเกินจำเป็น เช่น เลขบัตรประชาชนเต็ม รูปเอกสาร หรือรหัสผ่าน"
          required
        />
      </label>

      {status === 'done' && (
        <div style={{ ...notice, background: '#DCFCE7', color: '#166534', borderColor: '#BBF7D0' }}>
          รับคำขอแล้ว โรงเรียนจะตรวจสอบและติดต่อกลับตามช่องทางที่ระบุ
        </div>
      )}
      {status === 'error' && (
        <div style={{ ...notice, background: '#FEE2E2', color: '#991B1B', borderColor: '#FECACA' }}>
          ส่งคำขอไม่สำเร็จ กรุณาติดต่อโรงเรียนโดยตรงที่ 0880998990 หรือ websitekmd@gmail.com
        </div>
      )}

      <button type="submit" disabled={status === 'saving'} style={{
        justifySelf: 'start',
        border: 'none',
        borderRadius: 10,
        background: '#FF6A01',
        color: 'white',
        padding: '10px 14px',
        fontWeight: 900,
        cursor: status === 'saving' ? 'wait' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        opacity: status === 'saving' ? 0.75 : 1,
      }}>
        <Send size={16} /> {status === 'saving' ? 'กำลังส่งคำขอ...' : 'ส่งคำขอ'}
      </button>
    </form>
  );
}

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};

const label: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: '#334155',
  fontSize: '0.86rem',
  fontWeight: 800,
};

const input: CSSProperties = {
  width: '100%',
  border: '1px solid #CBD5E1',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#0F172A',
  fontSize: '0.95rem',
  fontWeight: 600,
  background: '#FFFFFF',
};

const notice: CSSProperties = {
  border: '1px solid',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: '0.86rem',
  fontWeight: 800,
};
