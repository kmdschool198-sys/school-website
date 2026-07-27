// แสดงครูโรงเรียนสาขาต่อท้ายหน้าบุคลากร
// อ่านจาก collection "branch_personnel" ซึ่งแยกจากบุคลากรโรงเรียนหลักโดยสิ้นเชิง
// ถ้ายังไม่มีข้อมูล จะไม่แสดงอะไรเลย (ไม่ขึ้นหัวข้อว่าง)
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ExternalLink } from 'lucide-react';
import { db } from '../firebase';
import DriveImage from './DriveImage';
import {
  BRANCH_PERSONNEL_COLLECTION,
  groupByBranch,
  type BranchPerson,
} from '../data/branches';

export default function BranchPersonnel() {
  const [people, setPeople] = useState<BranchPerson[]>([]);

  useEffect(() => {
    return onSnapshot(
      collection(db, BRANCH_PERSONNEL_COLLECTION),
      snap => {
        const items: BranchPerson[] = [];
        snap.forEach(d => items.push({ id: d.id, ...(d.data() as Omit<BranchPerson, 'id'>) }));
        setPeople(items);
      },
      error => console.error('Unable to load branch personnel', error),
    );
  }, []);

  const groups = groupByBranch(people);
  if (groups.length === 0) return null;

  return (
    <div style={{ marginTop: '5rem' }}>
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(135deg,#FFF7ED,#FFFFFF)',
        border: '1px solid #FFEDD5',
        borderLeft: '5px solid #FF6A01',
        borderRadius: 16,
        marginBottom: '2.5rem',
      }}>
        <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '1.15rem' }}>โรงเรียนสาขา</div>
        <div style={{ fontSize: '0.85rem', color: '#64748B' }}>
          คณะครูของโรงเรียนสาขาในสังกัดเดียวกัน
        </div>
      </div>

      {groups.map(({ branch, people: members }) => (
        <div key={branch.id} style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 1.75rem' }}>
            <span style={{ width: 6, height: 26, borderRadius: 4, background: 'linear-gradient(180deg,#0EA5E9,#38BDF8)' }} />
            <h3 style={{ margin: 0, fontWeight: 900, color: '#0F172A', fontSize: '1.25rem' }}>
              {branch.shortName}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 700 }}>
              {members.length} คน
            </span>
            <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,#E0F2FE,transparent)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.75rem' }}>
            {members.map(person => (
              <div
                key={person.id}
                className="reveal-item"
                style={{
                  background: 'white', borderRadius: 22, overflow: 'hidden',
                  border: '1px solid #F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                  textAlign: 'center', height: '100%',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 18px 40px rgba(14,165,233,0.16)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.04)';
                }}
              >
                <div style={{ height: 280, background: '#F8FAFC', overflow: 'hidden' }}>
                  <DriveImage src={person.image} alt={person.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '1.35rem' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E293B', marginBottom: '0.4rem' }}>
                    {person.name}
                  </h4>
                  {person.position && (
                    <p style={{ fontSize: '0.88rem', color: '#0EA5E9', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                      {person.position}
                    </p>
                  )}
                  {person.major && (
                    <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.25rem' }}>
                      วิชาเอก: <span style={{ fontWeight: 600 }}>{person.major}</span>
                    </div>
                  )}
                  {person.phone && (
                    <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      โทร: <a href={`tel:${person.phone}`} style={{ color: 'inherit', fontWeight: 600 }}>{person.phone}</a>
                    </div>
                  )}
                  {person.websiteUrl && (
                    <a
                      href={person.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
                        fontSize: '0.78rem', fontWeight: 700, color: '#0EA5E9', textDecoration: 'none',
                      }}
                    >
                      <ExternalLink size={12} /> เว็บไซต์
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
