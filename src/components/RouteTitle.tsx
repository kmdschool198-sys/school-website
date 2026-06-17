import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { pageContent } from '../data/pageContent';

const SCHOOL_NAME = 'โรงเรียนบ้านคลองมดแดง';
const DEFAULT_DESCRIPTION = 'เว็บไซต์โรงเรียนบ้านคลองมดแดง ข่าวสาร ตารางเรียน ระบบครู และบริการออนไลน์ของโรงเรียน';

const staticTitles: Record<string, string> = {
  '/': 'หน้าแรก',
  '/admin': 'ระบบผู้ดูแล',
  '/calendar': 'ปฏิทินโรงเรียน',
  '/attendance': 'ระบบเช็คชื่อนักเรียน',
  '/results': 'ประกาศผลสอบ',
  '/privacy': 'นโยบายความเป็นส่วนตัว',
  '/club-attendance': 'เช็คชื่อชุมนุมและลูกเสือ',
  '/teacher-hub': 'ศูนย์รวมระบบครู',
  '/milk-report': 'รายงานการดื่มนม',
  '/body-metrics': 'น้ำหนัก ส่วนสูง และ BMI',
  '/saving': 'ระบบออมเงิน',
  '/print-body-metrics': 'พิมพ์ฟอร์มน้ำหนักส่วนสูง',
  '/print-club': 'พิมพ์ฟอร์มชุมนุม',
  '/manage-clubs': 'จัดการชุมนุม',
  '/manage-roster': 'จัดการรายชื่อนักเรียน',
  '/brush-log': 'บันทึกการแปรงฟัน',
  '/milk-brush-report': 'รายงานนมและแปรงฟัน',
  '/class-dashboard': 'แดชบอร์ดรายชั้นเรียน',
  '/school-stats-report': 'รายงานสถิติประจำเดือน',
};

const printFormTitles: Record<string, string> = {
  attendance: 'พิมพ์ฟอร์มเช็คชื่อ',
  milk: 'พิมพ์ฟอร์มดื่มนม',
  brush: 'พิมพ์ฟอร์มแปรงฟัน',
};

export default function RouteTitle() {
  const location = useLocation();

  useEffect(() => {
    const sectionTitle = getSectionTitle(location.pathname);
    const fullTitle = sectionTitle ? `${sectionTitle} - ${SCHOOL_NAME}` : `${SCHOOL_NAME} - Modern Learning Portal`;
    document.title = fullTitle;
    updateMeta('description', DEFAULT_DESCRIPTION);
    updateMetaProperty('og:title', fullTitle);
    updateMetaProperty('og:description', DEFAULT_DESCRIPTION);
    updateMetaProperty('og:type', 'website');
    updateMetaProperty('og:url', window.location.href);
  }, [location.pathname]);

  return null;
}

function getSectionTitle(pathname: string) {
  if (staticTitles[pathname]) return staticTitles[pathname];

  const printMatch = matchPath('/print-form/:type', pathname);
  if (printMatch?.params.type) {
    return printFormTitles[printMatch.params.type] || 'พิมพ์แบบฟอร์ม';
  }

  const pageMatch = matchPath('/page/:slug', pathname);
  if (pageMatch?.params.slug) {
    return pageContent[pageMatch.params.slug]?.title || 'เนื้อหาโรงเรียน';
  }

  const personnelMatch = matchPath('/personnel/:slug', pathname);
  if (personnelMatch?.params.slug) {
    return pageContent[personnelMatch.params.slug]?.title || 'บุคลากร';
  }

  return 'ไม่พบหน้า';
}

function updateMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function updateMetaProperty(property: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.content = content;
}
