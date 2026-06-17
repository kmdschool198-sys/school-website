import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
  Mail,
  Phone,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PdpaRequestForm from '../components/PdpaRequestForm';

const updatedAt = '17 มิถุนายน 2569';
const privacyPhone = '0880998990';
const privacyEmail = 'websitekmd@gmail.com';

const sections = [
  {
    icon: <Database size={20} />,
    title: 'ข้อมูลที่เก็บ',
    body: 'ข้อมูลนักเรียน ผู้ปกครอง ครู และบุคลากร เช่น ชื่อ ชั้นเรียน รหัสนักเรียน การมาเรียน ผลการเรียน/ผลสอบ ข้อมูลกิจกรรม รูปภาพ เอกสารที่อัปโหลด และข้อมูลสุขภาพที่จำเป็นต่อการดูแลนักเรียน เช่น น้ำหนัก ส่วนสูง และ BMI',
  },
  {
    icon: <Scale size={20} />,
    title: 'วัตถุประสงค์และฐานกฎหมาย',
    body: 'ใช้เพื่อจัดการศึกษา ดูแลความปลอดภัยและสวัสดิภาพนักเรียน ประสานงานกับผู้ปกครอง รายงานต่อหน่วยงานต้นสังกัด เผยแพร่ข่าวสารโรงเรียน และปฏิบัติหน้าที่ของสถานศึกษา โดยอาศัยฐานภารกิจของรัฐ หน้าที่ตามกฎหมาย สัญญา ประโยชน์โดยชอบด้วยกฎหมาย และความยินยอมในกรณีที่กฎหมายกำหนด',
  },
  {
    icon: <Clock size={20} />,
    title: 'ระยะเวลาเก็บรักษา',
    body: 'เก็บเท่าที่จำเป็นตามวัตถุประสงค์ งานทะเบียน งานวัดผล และกฎหมาย/ระเบียบราชการที่เกี่ยวข้อง ข้อมูลประกาศหรือประชาสัมพันธ์จะทบทวนตามปีการศึกษา ส่วนข้อมูลสุขภาพและการเข้าใช้งานระบบจะจำกัดการเข้าถึงและเก็บเท่าที่จำเป็นต่อการดูแลนักเรียน',
  },
  {
    icon: <Users size={20} />,
    title: 'ผู้รับข้อมูล',
    body: 'อาจเปิดเผยต่อผู้ปกครอง หน่วยงานต้นสังกัด หน่วยงานรัฐที่มีอำนาจตามกฎหมาย ผู้ให้บริการระบบที่จำเป็น เช่น Firebase/Google Drive/Google Photos/Google Maps และผู้ให้บริการสื่อสังคมออนไลน์เมื่อผู้ใช้กดเปิดบริการภายนอก',
  },
];

const rights = [
  'ขอเข้าถึงหรือขอรับสำเนาข้อมูลส่วนบุคคล',
  'ขอแก้ไขข้อมูลให้ถูกต้อง เป็นปัจจุบัน และสมบูรณ์',
  'ขอถอนความยินยอมเมื่อการประมวลผลอาศัยความยินยอม',
  'ขอคัดค้าน ระงับใช้ หรือลบข้อมูลตามเงื่อนไขของกฎหมาย',
  'ร้องเรียนต่อโรงเรียนหรือหน่วยงานกำกับดูแลเมื่อเห็นว่าข้อมูลถูกใช้ไม่ถูกต้อง',
];

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', color: '#0F172A' }}>
      <Header />
      <main>
        <section style={{ background: 'linear-gradient(135deg,#FFF7ED,#FFFFFF)', borderBottom: '1px solid #FFEDD5' }}>
          <div style={container}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#FF6A01', fontWeight: 800, marginBottom: 12 }}>
              <ShieldCheck size={18} /> PDPA Notice
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.6rem)', fontWeight: 950, margin: 0, lineHeight: 1.05 }}>
              นโยบายคุ้มครองข้อมูลส่วนบุคคล
            </h1>
            <p style={{ ...lead, maxWidth: 820 }}>
              โรงเรียนบ้านคลองมดแดงแจ้งการเก็บ ใช้ เปิดเผย และคุ้มครองข้อมูลส่วนบุคคลของนักเรียน ผู้ปกครอง ครู บุคลากร และผู้ใช้เว็บไซต์ ก่อนหรือขณะเก็บข้อมูลตามหลัก PDPA
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
              <Badge>ปรับปรุงล่าสุด {updatedAt}</Badge>
              <Badge>ผู้ควบคุมข้อมูล: โรงเรียนบ้านคลองมดแดง</Badge>
            </div>
          </div>
        </section>

        <section style={band}>
          <div style={container}>
            <h2 style={heading}>ผู้ควบคุมข้อมูลและช่องทางติดต่อ</h2>
            <div style={contactPanel}>
              <div>
                <h3 style={subheading}>โรงเรียนบ้านคลองมดแดง</h3>
                <p style={paragraph}>
                  เลขที่ 198 หมู่ 3 ตำบลโป่งน้ำร้อน อำเภอคลองลาน จังหวัดกำแพงเพชร 62180
                </p>
                <p style={paragraph}>
                  ติดต่อเรื่องข้อมูลส่วนบุคคลได้ที่ผู้บริหารโรงเรียนหรือเจ้าหน้าที่ที่ได้รับมอบหมาย ผ่านช่องทางติดต่อของโรงเรียน
                </p>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                <ContactLine icon={<Phone size={16} />} label="โทรศัพท์" value={privacyPhone} />
                <ContactLine icon={<Mail size={16} />} label="อีเมล" value={privacyEmail} />
                <ContactLine icon={<ExternalLink size={16} />} label="Facebook" value="โรงเรียนบ้านคลองมดแดง" />
              </div>
            </div>
          </div>
        </section>

        <section style={{ ...band, background: '#FFFFFF' }}>
          <div style={container}>
            <h2 style={heading}>รายละเอียดการประมวลผลข้อมูล</h2>
            <div style={grid}>
              {sections.map(section => (
                <article key={section.title} style={infoCard}>
                  <div style={iconBox}>{section.icon}</div>
                  <h3 style={cardTitle}>{section.title}</h3>
                  <p style={paragraph}>{section.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={band}>
          <div style={container}>
            <h2 style={heading}>ความยินยอมเฉพาะกรณี</h2>
            <div style={consentGrid}>
              <SensitiveBlock
                title="ข้อมูลสุขภาพ"
                text="การบันทึกน้ำหนัก ส่วนสูง BMI หรือข้อมูลสุขภาพอื่นใช้เพื่อดูแลนักเรียนและรายงานภายในโรงเรียนเท่านั้น ผู้ใช้งานครูต้องรับทราบ notice ก่อนบันทึก และสิทธิอ่าน/เขียนถูกจำกัดด้วย Firebase Auth + Firestore Rules"
              />
              <SensitiveBlock
                title="รูปภาพและวิดีโอเด็ก"
                text="การเผยแพร่รูปหรืออัลบั้มกิจกรรมที่เห็นตัวเด็กชัดเจนควรมีความยินยอมจากผู้ปกครองหรือเป็นกิจกรรมที่โรงเรียนมีฐานกฎหมายรองรับ และต้องหลีกเลี่ยงข้อมูลที่ทำให้เด็กเสี่ยงต่ออันตราย"
              />
              <SensitiveBlock
                title="บริการ Third-party"
                text="เว็บไซต์อาจใช้ Firebase, Google Drive, Google Photos, Google Maps, YouTube, TikTok และ Facebook การกดเปิดลิงก์หรือ embed บางส่วนอาจส่งข้อมูลการใช้งานไปยังผู้ให้บริการเหล่านั้นตามนโยบายของแต่ละบริการ"
              />
            </div>
          </div>
        </section>

        <section style={{ ...band, background: '#FFFFFF' }}>
          <div style={container}>
            <h2 style={heading}>สิทธิของเจ้าของข้อมูล</h2>
            <ul style={rightsList}>
              {rights.map(item => <li key={item}>{item}</li>)}
            </ul>
            <div style={warningBox}>
              <AlertTriangle size={20} />
              <p style={{ margin: 0 }}>
                หากเกิดเหตุละเมิดข้อมูลส่วนบุคคล โรงเรียนจะตรวจสอบ ลดผลกระทบ และแจ้งหน่วยงาน/เจ้าของข้อมูลตามเงื่อนไขที่กฎหมายกำหนด รวมถึงกรอบเวลา 72 ชั่วโมงเมื่อเข้าเกณฑ์ต้องแจ้งเหตุ
              </p>
            </div>
          </div>
        </section>

        <section style={band}>
          <div style={container}>
            <h2 style={heading}>ช่องทางใช้สิทธิและแจ้งเหตุ</h2>
            <p style={{ ...paragraph, marginBottom: 16 }}>
              ส่งคำขอผ่านฟอร์มด้านล่าง หรือโทร {privacyPhone} / อีเมล {privacyEmail} โดยโรงเรียนจะบันทึกคำขอไว้เพื่อติดตามสถานะและตรวจสอบย้อนหลัง
            </p>
            <PdpaRequestForm />
          </div>
        </section>

        <section style={band}>
          <div style={container}>
            <h2 style={heading}>อ้างอิงและความปลอดภัยของระบบ</h2>
            <p style={paragraph}>
              ระบบหลังบ้านใช้ Firebase Auth สำหรับยืนยันตัวตน และ Firestore Rules เพื่อจำกัดการอ่าน/เขียนข้อมูลสำคัญ เช่น การเช็คชื่อ ข้อมูลสุขภาพ เงินออม ใบลา และผลสอบ ส่วนหน้า <Link to="/results" style={inlineLink}>ประกาศผลสอบ</Link> แสดงเฉพาะข้อมูลประกาศสาธารณะและค้นผลรายคนจากรหัส ไม่โหลดข้อมูลผลสอบทุกคนลง browser
            </p>
            <p style={paragraph}>
              นโยบายนี้อ้างอิงหลัก PDPA ไทยที่มีผลใช้บังคับเต็มรูปแบบตั้งแต่ 1 มิถุนายน 2565 และแนวปฏิบัติเรื่อง notice, consent, security measures และ breach notification ตามแหล่งอ้างอิงที่โรงเรียนใช้ตรวจสอบ
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '8px 12px',
      borderRadius: 999, background: '#FFFFFF', border: '1px solid #FFEDD5',
      color: '#7C2D12', fontSize: '0.82rem', fontWeight: 800,
    }}>
      {children}
    </span>
  );
}

function ContactLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ color: '#FF6A01', background: '#FFF7ED', padding: 8, borderRadius: 8 }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function SensitiveBlock({ title, text }: { title: string; text: string }) {
  return (
    <article style={sensitiveCard}>
      <h3 style={cardTitle}>{title}</h3>
      <p style={paragraph}>{text}</p>
    </article>
  );
}

const container: CSSProperties = {
  maxWidth: 1120,
  margin: '0 auto',
  padding: '4.5rem 1.25rem',
};

const band: CSSProperties = {
  background: '#F8FAFC',
  borderBottom: '1px solid #E2E8F0',
};

const lead: CSSProperties = {
  color: '#475569',
  fontSize: '1.05rem',
  lineHeight: 1.8,
  margin: '1.25rem 0 0',
};

const heading: CSSProperties = {
  fontSize: 'clamp(1.45rem, 4vw, 2rem)',
  fontWeight: 900,
  margin: '0 0 1.25rem',
};

const subheading: CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 900,
  margin: '0 0 0.75rem',
};

const paragraph: CSSProperties = {
  color: '#475569',
  lineHeight: 1.75,
  margin: 0,
};

const contactPanel: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(260px, 0.7fr)',
  gap: 24,
  padding: '1.25rem',
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
};

const infoCard: CSSProperties = {
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: 12,
  padding: '1.25rem',
};

const iconBox: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#FFF7ED',
  color: '#FF6A01',
  marginBottom: 14,
};

const cardTitle: CSSProperties = {
  margin: '0 0 0.55rem',
  fontSize: '1rem',
  fontWeight: 900,
};

const consentGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
};

const sensitiveCard: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #FED7AA',
  borderLeft: '4px solid #FF6A01',
  borderRadius: 12,
  padding: '1.25rem',
};

const rightsList: CSSProperties = {
  display: 'grid',
  gap: 10,
  margin: '0 0 1.5rem',
  paddingLeft: '1.25rem',
  color: '#334155',
  lineHeight: 1.7,
  fontWeight: 650,
};

const warningBox: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  padding: '1rem',
  borderRadius: 12,
  background: '#FEF2F2',
  border: '1px solid #FECACA',
  color: '#991B1B',
};

const inlineLink: CSSProperties = {
  color: '#FF6A01',
  fontWeight: 900,
  textDecoration: 'none',
};
