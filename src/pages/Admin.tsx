import { useState, useEffect, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import {
  Settings,
  Users,
  Layout,
  ShieldCheck,
  LogOut,
  Trash2,
  Rss,
  Edit2,
  X,
  Globe,
  Sparkles,
  Image as ImageIcon,
  Database,
  CheckCircle2,
  AlertTriangle,
  Save,
  ArrowUp,
  ArrowDown,
  Type,
  AlignLeft,
  Minus,
  Calendar as CalendarIcon,
  ExternalLink,
  RefreshCw,
  MessageCircle,
  Search,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import TimetableSmart from '../components/TimetableSmart';
import RosterManager from '../components/RosterManager';
import ClubsManager from '../components/ClubsManager';
import {
  collection, addDoc, getDocs, deleteDoc, doc, orderBy, query,
  updateDoc, setDoc, getDoc, writeBatch, onSnapshot
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { pageContent as staticPageContent } from '../data/pageContent';
import DriveImage from '../components/DriveImage';
import DriveImageInput from '../components/DriveImageInput';
import GooglePhotosInput from '../components/GooglePhotosInput';
import PdpaNotice from '../components/PdpaNotice';
import Toast from '../components/Toast';
import { DEFAULT_STUDENTS } from '../data/defaultStudents';
import { SCHOOL_EMAIL, SCHOOL_PHONE } from '../config/siteLinks';
import PersonnelSync from '../components/PersonnelSync';
import BranchPersonnelManager from '../components/BranchPersonnelManager';
import {
  STAFF_ROLE_LABELS,
  STAFF_ROLE_OPTIONS,
  STAFF_USERS_COLLECTION,
  canManageStaffUsers,
  canUseWebsiteAdmin,
  getAuthorizedStaffProfile,
  resolveStaffEmail,
  roleFromClaim,
  roleLabel,
  type Role,
  type StaffManageRole,
  type StaffProfile,
} from '../utils/teacherAuth';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../App.css';

interface Post {
  id: string;
  title: string;
  content: string;
  date: string;
  category?: string;
  imageUrl?: string;
  imageType?: 'image' | 'pdf';
  albumUrl?: string;
  tiktokUrl?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  documentUrl?: string;
}

interface Personnel {
  id: string;
  name: string;
  position: string;
  major?: string;
  positionNumber?: string;
  phone?: string;
  email?: string;
  category: string;
  workGroup?: string;
  image: string;
  order: number;
  isHead?: boolean;
}

export type ContentBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'image'; url: string; caption?: string }
  | { id: string; type: 'divider' };

interface Highlight {
  id: string;
  badge: string;
  title: string;
  titleAccent: string;
  description: string;
  buttonText: string;
  imageUrl: string;
  imageType?: 'image' | 'pdf';
  order: number;
}

type AdminTab = 'dashboard' | 'news' | 'highlights' | 'personnel' | 'branch-personnel' | 'contents' | 'activities' | 'students' | 'timetable' | 'roster' | 'clubs' | 'staff' | 'settings';

interface StudentRow {
  class: string;
  male: number;
  female: number;
  teacher: string;
  teacherId?: string;
  note: string;
}

interface Activity {
  id: string;
  date: string;
  endDate?: string;
  title: string;
  description?: string;
  location?: string;
  time?: string;
  isHoliday?: boolean;
  color?: string;
}

interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffManageRole;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,237,213,0.9)',
  borderRadius: '24px',
  boxShadow: '0 10px 40px rgba(255,106,1,0.08)'
};

const ADMIN_EMAILS = [
  import.meta.env.VITE_KMD_ADMIN_EMAIL,
  import.meta.env.VITE_KMD_SUPER_EMAIL,
  import.meta.env.VITE_KMD_TEACHER_EMAIL,
  'adminkmd@web-site-kmd.firebaseapp.com',
  'jameskmd@web-site-kmd.firebaseapp.com',
].filter(Boolean) as string[];

const PASSWORD_LOGIN_HELP = 'บัญชีที่เพิ่มจาก Gmail ให้กด “เข้าสู่ระบบด้วย Google” ช่องรหัสผ่านใช้ได้เฉพาะบัญชี Firebase Email/Password ที่สร้างไว้แล้ว';

function resolveAdminEmail(usernameOrEmail: string) {
  const value = usernameOrEmail.trim();
  if (value.includes('@')) return value;
  if (value === 'adminkmd' && import.meta.env.VITE_KMD_ADMIN_EMAIL) {
    return import.meta.env.VITE_KMD_ADMIN_EMAIL;
  }
  return resolveStaffEmail(value);
}

function normalizeStaffEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePersonName(value: string | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('th-TH');
}

function toManageRole(role: Role | null | undefined): StaffManageRole {
  if (role === 'owner' || role === 'admin' || role === 'editor' || role === 'teacher') return role;
  if (role === 'super') return 'owner';
  return 'teacher';
}

function adminLoginErrorMessage(error: unknown, fallback: string) {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === 'auth/unauthorized-domain') {
    return 'Google login ยังไม่พร้อม: ต้องเพิ่มโดเมนนี้ใน Firebase Auth > Settings > Authorized domains';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'ยกเลิกการเข้าสู่ระบบด้วย Google';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
    return PASSWORD_LOGIN_HELP;
  }
  return fallback;
}

async function getAdminAccess(user: User): Promise<{ allowed: boolean; profile: StaffProfile | null }> {
  let token;
  try {
    token = await getIdTokenResult(user, true);
  } catch (err: any) {
    if (err?.code === 'auth/network-request-failed') {
      token = await getIdTokenResult(user, false);
    } else {
      throw err;
    }
  }
  const staffProfile = await getAuthorizedStaffProfile(user);
  const claimRole = roleFromClaim(token.claims.role);
  const isAdminClaim = token.claims.admin === true || canUseWebsiteAdmin(claimRole);
  const isAdminProfile = canUseWebsiteAdmin(staffProfile?.role);
  const isAdminEmailFallback = ADMIN_EMAILS.includes(user.email || '');
  const fallbackProfile: StaffProfile | null = isAdminEmailFallback
    ? {
        email: user.email || '',
        role: 'owner',
        name: user.displayName || user.email || 'ผู้ดูแลระบบ',
        active: true,
      }
    : null;

  return {
    allowed: isAdminClaim || isAdminProfile || isAdminEmailFallback,
    profile: staffProfile || fallbackProfile,
  };
}

function Admin() {
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false, message: '', type: 'success'
  });
  const showToast = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ show: true, message, type });

  // Confirm modal
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; onConfirm: () => void }>({
    open: false, message: '', onConfirm: () => {}
  });
  const askConfirm = (message: string, onConfirm: () => void) =>
    setConfirmState({ open: true, message, onConfirm });

  // DB Status
  const [dbStatus, setDbStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // News
  const [posts, setPosts] = useState<Post[]>([]);
  const [postId, setPostId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('ข่าวประชาสัมพันธ์');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageType, setNewImageType] = useState<'image' | 'pdf'>('image');
  const [newAlbumUrl, setNewAlbumUrl] = useState('');
  const [newTiktokUrl, setNewTiktokUrl] = useState('');
  const [newFacebookUrl, setNewFacebookUrl] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [newDocumentUrl, setNewDocumentUrl] = useState('');
  const [childMediaConsentOk, setChildMediaConsentOk] = useState(true);
  const [bulkMediaConsentOk, setBulkMediaConsentOk] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportJson, setBulkImportJson] = useState('');
  const [showAdvancedPostFields, setShowAdvancedPostFields] = useState(false);
  const [postSearch, setPostSearch] = useState('');
  const [postCategoryFilter, setPostCategoryFilter] = useState('all');

  // Students count — seed from DEFAULT_STUDENTS so admin form has same data as public page
  const [studentsTitle, setStudentsTitle] = useState(DEFAULT_STUDENTS.title);
  const [studentsSubtitle, setStudentsSubtitle] = useState(DEFAULT_STUDENTS.subtitle);
  const [studentRows, setStudentRows] = useState<StudentRow[]>(DEFAULT_STUDENTS.rows);

  // Personnel
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [pName, setPName] = useState('');
  const [pPos, setPPos] = useState('');
  const [pCat, setPCat] = useState('teacher');
  const [pWorkGroup, setPWorkGroup] = useState('none');
  const [pImage, setPImage] = useState('');
  const [pIsHead, setPIsHead] = useState(false);
  const [pMajor, setPMajor] = useState('');
  const [pPosNum, setPPosNum] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pWebsite, setPWebsite] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Highlights
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [hId, setHId] = useState<string | null>(null);
  const [hBadge, setHBadge] = useState('Excellence');
  const [hTitle, setHTitle] = useState('');
  const [hAccent, setHAccent] = useState('');
  const [hDesc, setHDesc] = useState('');
  const [hBtn, setHBtn] = useState('อ่านรายละเอียด');
  const [hImg, setHImg] = useState('');
  const [hImgType, setHImgType] = useState<'image' | 'pdf'>('image');

  // Activities
  const [activities, setActivities] = useState<Activity[]>([]);
  const [aId, setAId] = useState<string | null>(null);
  const [aDate, setADate] = useState(new Date().toISOString().slice(0, 10));
  const [aEndDate, setAEndDate] = useState('');
  const [aTitle, setATitle] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aLoc, setALoc] = useState('');
  const [aTime, setATime] = useState('');
  const [aHoliday, setAHoliday] = useState(false);
  const [aColor, setAColor] = useState('#FF6A01');

  // Settings
  const [schoolSettings, setSchoolSettings] = useState({
    name: 'โรงเรียนบ้านคลองมดแดง',
    motto: 'พัฒนา สามัคคี มีวินัย',
    address: '198 ม.3 ต.โป่งน้ำร้อน อ.คลองลาน จ.กำแพงเพชร 62180',
    phone: SCHOOL_PHONE,
    email: SCHOOL_EMAIL,
    facebook: 'โรงเรียนบ้านคลองมดแดง',
    logoUrl: ''
  });

  const [homeAssets, setHomeAssets] = useState({
    homeAboutImg: '',
    homeHighlight1Img: '',
    homeHighlight2Img: ''
  });

  // Content Editor
  const [selectedSlug, setSelectedSlug] = useState('');
  const [pageTitleText, setPageTitleText] = useState('');
  const [pageContentText, setPageContentText] = useState('');
  const [pageBannerUrl, setPageBannerUrl] = useState('');
  const [pageBlocks, setPageBlocks] = useState<ContentBlock[]>([]);

  // Staff access management
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<StaffManageRole>('teacher');
  const [staffActive, setStaffActive] = useState(true);
  const [editingStaffEmail, setEditingStaffEmail] = useState<string | null>(null);
  const canManageUsers = canManageStaffUsers(currentStaff?.role);

  useEffect(() => {
    let alive = true;
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setAuthChecking(true);
      try {
        const access = user ? await getAdminAccess(user) : { allowed: false, profile: null };
        if (!access.allowed && user) await signOut(auth);
        if (alive) {
          setIsLoggedIn(access.allowed);
          setCurrentStaff(access.profile);
        }
      } catch (error) {
        console.error('Unable to verify admin auth state', error);
        if (alive) {
          setIsLoggedIn(false);
          setCurrentStaff(null);
        }
      } finally {
        if (alive) setAuthChecking(false);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshAll();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const personnelQuery = query(collection(db, 'personnel'), orderBy('order', 'asc'));
    return onSnapshot(personnelQuery, snapshot => {
      setPersonnelList(snapshot.docs.map(personnelDoc => ({
        id: personnelDoc.id,
        ...personnelDoc.data(),
      } as Personnel)));
    }, error => {
      console.error('Unable to watch personnel', error);
      showToast('เชื่อมข้อมูลบุคลากรแบบเรียลไทม์ไม่สำเร็จ', 'error');
    });
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !canManageUsers) {
      setStaffUsers([]);
      return;
    }
    loadStaffUsers();
  }, [isLoggedIn, canManageUsers]);

  useEffect(() => {
    if (activeTab === 'staff' && !canManageUsers) setActiveTab('dashboard');
  }, [activeTab, canManageUsers]);

  const refreshAll = async () => {
    setDbStatus('checking');
    try {
      await Promise.all([loadNews(), loadPersonnel(), loadHighlights(), loadActivities(), loadSettings()]);
      setDbStatus('online');
    } catch (e) {
      console.error(e);
      setDbStatus('offline');
    }
  };

  const loadSettings = async () => {
    const snap = await getDoc(doc(db, 'config', 'school_info'));
    if (snap.exists()) {
      const data = snap.data() as any;
      setSchoolSettings(prev => ({
        ...prev,
        ...data,
        phone: data.phone && data.phone !== '055-xxx-xxx' ? data.phone : prev.phone,
        email: data.email || prev.email,
      }));
    }
    const snapHome = await getDoc(doc(db, 'config', 'home_assets'));
    if (snapHome.exists()) setHomeAssets(snapHome.data() as any);
    const snapStu = await getDoc(doc(db, 'config', 'students_count'));
    if (snapStu.exists()) {
      const d = snapStu.data() as any;
      if (d.title) setStudentsTitle(d.title);
      if (d.subtitle) setStudentsSubtitle(d.subtitle);
      if (Array.isArray(d.rows)) setStudentRows(d.rows);
    }
  };

  const saveStudents = async () => {
    setLoading(true);
    try {
      const linkedRows = studentRows.map(row => {
        const linkedPerson = personnelList.find(person => person.id === row.teacherId)
          || personnelList.find(person => normalizePersonName(person.name) === normalizePersonName(row.teacher));
        return {
          class: String(row.class || '').trim(),
          male: Number(row.male) || 0,
          female: Number(row.female) || 0,
          teacher: linkedPerson ? linkedPerson.name : (row.teacherId ? '' : String(row.teacher || '').trim()),
          teacherId: linkedPerson ? linkedPerson.id : '',
          note: String(row.note || '').trim()
        };
      });
      await setDoc(doc(db, 'config', 'students_count'), {
        title: String(studentsTitle || 'สถิติจำนวนนักเรียน').trim(),
        subtitle: String(studentsSubtitle || '').trim(),
        rows: linkedRows,
        updatedAt: Date.now()
      });
      setStudentRows(linkedRows);
      showToast('บันทึกข้อมูลนักเรียนเรียบร้อย', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('บันทึกไม่สำเร็จ: ' + (e?.message || ''), 'error');
    }
    setLoading(false);
  };

  const updateStudentRow = (i: number, field: keyof StudentRow, value: any) => {
    setStudentRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };
  const addStudentRow = () => setStudentRows(rows => [...rows, { class: '', male: 0, female: 0, teacher: '', note: '' }]);
  const removeStudentRow = (i: number) => setStudentRows(rows => rows.filter((_, idx) => idx !== i));

  const syncFromRoster = async () => {
    if (!window.confirm('คำเตือน: ยอดรวมชาย/หญิงจะถูกดึงจาก "รายชื่อนักเรียน" มาทับข้อมูลปัจจุบัน ยืนยันหรือไม่?')) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'config', 'attendance_classes'));
      if (snap.exists()) {
        const data = snap.data() as { classes: any[] };
        const isMale = (n: string) => /เด็กชาย|นาย|ด\.ช\./.test(n);
        const isFemale = (n: string) => /เด็กหญิง|น\.ส\.|ด\.ญ\.|นางสาว|นาง/.test(n);
        
        const newRows = data.classes.map(c => {
          const male = c.students.filter((s: any) => isMale(s.name)).length;
          const female = c.students.filter((s: any) => isFemale(s.name)).length;
          const existing = studentRows.find(r => r.class === c.label);
          return {
            class: c.label,
            male,
            female,
            teacher: existing?.teacher || '',
            note: existing?.note || ''
          };
        });
        setStudentRows(newRows);
        showToast('ดึงข้อมูลรายชื่อสำเร็จ! กรุณากดบันทึก', 'success');
      } else {
        showToast('ไม่พบข้อมูลรายชื่อนักเรียนในระบบ', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการดึงข้อมูล', 'error');
    }
    setLoading(false);
  };

  const loadNews = async () => {
    const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
  };

  const loadPersonnel = async () => {
    const q = query(collection(db, 'personnel'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    setPersonnelList(snap.docs.map(d => ({ id: d.id, ...d.data() } as Personnel)));
  };

  const loadHighlights = async () => {
    const q = query(collection(db, 'highlights'), orderBy('order', 'asc'));
    const snap = await getDocs(q);
    setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() } as Highlight)));
  };

  const loadActivities = async () => {
    const q = query(collection(db, 'activities'), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity)));
  };

  const loadStaffUsers = async () => {
    if (!canManageUsers) return;
    try {
      const snap = await getDocs(collection(db, STAFF_USERS_COLLECTION));
      const users = snap.docs.map(d => {
        const data = d.data() as Partial<StaffUser> & { displayName?: string; role?: unknown };
        return {
          id: d.id,
          email: data.email || d.id,
          name: data.name || data.displayName || data.email || d.id,
          role: toManageRole(roleFromClaim(data.role)),
          active: data.active !== false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy,
        };
      }).sort((a, b) => {
        const order = STAFF_ROLE_OPTIONS.indexOf(a.role) - STAFF_ROLE_OPTIONS.indexOf(b.role);
        return order === 0 ? a.email.localeCompare(b.email) : order;
      });
      setStaffUsers(users);
    } catch (error) {
      console.error('Unable to load staff users', error);
      showToast('โหลดรายชื่อผู้ใช้ไม่สำเร็จ', 'error');
    }
  };

  const resetStaffForm = () => {
    setStaffEmail('');
    setStaffName('');
    setStaffRole('teacher');
    setStaffActive(true);
    setEditingStaffEmail(null);
  };

  const handleSubmitStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManageUsers) {
      showToast('บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้', 'error');
      return;
    }

    const email = normalizeStaffEmail(staffEmail);
    if (!email || !email.includes('@')) {
      showToast('กรุณากรอก Gmail/อีเมลให้ถูกต้อง', 'error');
      return;
    }
    if (email === normalizeStaffEmail(currentStaff?.email || '') && !staffActive) {
      showToast('ไม่ควรปิดสิทธิ์บัญชีที่กำลังใช้งานอยู่', 'error');
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, STAFF_USERS_COLLECTION, email), {
        email,
        name: staffName.trim() || email,
        displayName: staffName.trim() || email,
        role: staffRole,
        active: staffActive,
        updatedAt: now,
        updatedBy: currentStaff?.email || auth.currentUser?.email || '',
        ...(editingStaffEmail ? {} : { createdAt: now }),
      }, { merge: true });
      showToast(editingStaffEmail ? 'อัปเดตสิทธิ์ผู้ใช้แล้ว' : 'เพิ่ม Gmail เข้ารายชื่อผู้ใช้แล้ว', 'success');
      resetStaffForm();
      await loadStaffUsers();
    } catch (error) {
      console.error('Unable to save staff user', error);
      showToast('บันทึกสิทธิ์ผู้ใช้ไม่สำเร็จ', 'error');
    }
    setLoading(false);
  };

  const handleEditStaff = (user: StaffUser) => {
    setEditingStaffEmail(user.email);
    setStaffEmail(user.email);
    setStaffName(user.name);
    setStaffRole(user.role);
    setStaffActive(user.active);
  };

  const handleDeleteStaff = (email: string) => {
    const normalizedEmail = normalizeStaffEmail(email);
    if (normalizedEmail === normalizeStaffEmail(currentStaff?.email || '')) {
      showToast('ไม่ควรลบสิทธิ์บัญชีที่กำลังใช้งานอยู่', 'error');
      return;
    }
    askConfirm(`ลบสิทธิ์ผู้ใช้ ${normalizedEmail}?`, async () => {
      try {
        await deleteDoc(doc(db, STAFF_USERS_COLLECTION, normalizedEmail));
        showToast('ลบสิทธิ์ผู้ใช้แล้ว', 'success');
        await loadStaffUsers();
      } catch (error) {
        console.error('Unable to delete staff user', error);
        showToast('ลบสิทธิ์ผู้ใช้ไม่สำเร็จ', 'error');
      }
    });
  };

  // ---------- Activities ----------
  const resetActivityForm = () => {
    setAId(null); setADate(new Date().toISOString().slice(0, 10)); setAEndDate('');
    setATitle(''); setADesc(''); setALoc(''); setATime(''); setAHoliday(false); setAColor('#FF6A01');
  };

  const handleSubmitActivity = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = {
        date: aDate || new Date().toISOString().slice(0, 10),
        title: (aTitle || '').trim(),
        description: (aDesc || '').trim(),
        location: (aLoc || '').trim(),
        time: (aTime || '').trim(),
        isHoliday: Boolean(aHoliday),
        color: aColor || '#FF6A01',
      };
      if (aEndDate) data.endDate = aEndDate.trim();
      if (aId) {
        await setDoc(doc(db, 'activities', aId), data, { merge: true });
        setActivities(prev => prev.map(a => a.id === aId ? { ...a, ...data } : a));
        showToast('อัปเดตกิจกรรมแล้ว', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'activities'), data);
        setActivities(prev => [...prev, { id: docRef.id, ...data }]);
        showToast('เพิ่มกิจกรรมสำเร็จ', 'success');
      }
      resetActivityForm();
      await loadActivities();
    } catch (err: any) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ: ' + (err?.message || ''), 'error');
    }
    setLoading(false);
  };

  const handleEditActivity = (a: Activity) => {
    setAId(a.id); setADate(a.date || new Date().toISOString().slice(0, 10)); setAEndDate(a.endDate || '');
    setATitle(a.title || ''); setADesc(a.description || ''); setALoc(a.location || '');
    setATime(a.time || ''); setAHoliday(!!a.isHoliday); setAColor(a.color || '#FF6A01');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteActivity = (id: string) => {
    askConfirm('ลบกิจกรรมนี้?', async () => {
      try {
        await deleteDoc(doc(db, 'activities', id));
        setActivities(prev => prev.filter(a => a.id !== id));
        showToast('ลบกิจกรรมแล้ว', 'success');
        await loadActivities();
      } catch (err: any) {
        console.error(err);
        showToast('ลบไม่สำเร็จ: ' + (err?.message || ''), 'error');
      }
    });
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, resolveAdminEmail(username), password);
      const access = await getAdminAccess(credential.user);
      if (!access.allowed) {
        await signOut(auth);
        setLoginError('บัญชีนี้ยังไม่มีสิทธิ์เข้า Admin หรือยังไม่ได้ตั้ง role เป็น Owner/Admin/Editor');
        return;
      }
      setIsLoggedIn(true);
      setCurrentStaff(access.profile);
    } catch (error) {
      console.error('Admin login failed', error);
      setLoginError(adminLoginErrorMessage(error, PASSWORD_LOGIN_HELP));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      const access = await getAdminAccess(credential.user);
      if (!access.allowed) {
        await signOut(auth);
        setLoginError('อีเมล Google นี้ยังไม่ได้อยู่ในรายชื่อผู้ใช้ หรือ role ยังไม่ใช่ Owner/Admin/Editor');
        return;
      }
      setIsLoggedIn(true);
      setCurrentStaff(access.profile);
    } catch (error) {
      console.error('Admin Google login failed', error);
      setLoginError(adminLoginErrorMessage(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาเช็ก Google provider และ authorized domains ใน Firebase'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsLoggedIn(false);
    setCurrentStaff(null);
    setStaffUsers([]);
  };

  // ---------- Posts ----------
  const resetPostForm = () => {
    setPostId(null); setNewTitle(''); setNewContent(''); setNewImageUrl(''); setNewImageType('image'); 
    setNewAlbumUrl(''); setNewTiktokUrl(''); setNewFacebookUrl(''); setNewWebsiteUrl(''); setNewDocumentUrl('');
    setNewCategory('ข่าวประชาสัมพันธ์');
    setNewDate(new Date().toISOString().split('T')[0]);
    setShowAdvancedPostFields(false);
  };

  const handleSubmitPost = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = {
        title: (newTitle || '').trim(),
        content: (newContent || '').trim(),
        category: newCategory || 'ข่าวประชาสัมพันธ์',
        imageUrl: (newImageUrl || '').trim(),
        imageType: newImageType || 'image',
        albumUrl: (newAlbumUrl || '').trim(),
        tiktokUrl: (newTiktokUrl || '').trim(),
        facebookUrl: (newFacebookUrl || '').trim(),
        websiteUrl: (newWebsiteUrl || '').trim(),
        documentUrl: (newDocumentUrl || '').trim(),
        date: newDate || new Date().toISOString().split('T')[0],
        childMediaConsent: Boolean(childMediaConsentOk),
      };
      if (postId) {
        await setDoc(doc(db, 'posts', postId), data, { merge: true });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...data } : p));
        showToast('อัปเดตโพสต์เรียบร้อย', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'posts'), data);
        setPosts(prev => [{ id: docRef.id, ...data }, ...prev]);
        showToast('เพิ่มโพสต์ใหม่สำเร็จ', 'success');
      }
      resetPostForm();
      await loadNews();
    } catch (err: any) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ: ' + (err?.message || ''), 'error');
    }
    setLoading(false);
  };

  const importBulkNewsJson = async (jsonText: string) => {
    if (!bulkMediaConsentOk) {
      showToast('กรุณายืนยันสิทธิ์เผยแพร่รูปข่าวก่อนนำเข้า', 'error');
      return;
    }

    setBulkImporting(true);
    try {
      const raw = JSON.parse(jsonText);
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > 450) {
        throw new Error('invalid-import-size');
      }

      const existingByFacebookUrl = new Map(
        posts
          .filter(post => post.facebookUrl?.trim())
          .map(post => [post.facebookUrl!.trim(), post])
      );
      const seenFacebookUrls = new Set<string>();
      const batch = writeBatch(db);
      let created = 0;
      let updated = 0;

      raw.forEach((record: Record<string, unknown>) => {
        const title = String(record.title || '').trim();
        const date = String(record.date || '').trim();
        const facebookUrl = String(record.facebookUrl || '').trim();
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error('invalid-import-record');
        }
        if (facebookUrl && seenFacebookUrls.has(facebookUrl)) return;
        if (facebookUrl) seenFacebookUrls.add(facebookUrl);

        const data = {
          title,
          date,
          category: 'ข่าวประชาสัมพันธ์',
          content: String(record.content || '').trim(),
          imageUrl: String(record.imageUrl || '').trim(),
          imageType: record.imageType === 'pdf' ? 'pdf' : 'image',
          albumUrl: String(record.albumUrl || '').trim(),
          tiktokUrl: String(record.tiktokUrl || '').trim(),
          facebookUrl,
          websiteUrl: String(record.websiteUrl || '').trim(),
          documentUrl: String(record.documentUrl || '').trim(),
        };

        const existing = facebookUrl ? existingByFacebookUrl.get(facebookUrl) : undefined;
        const target = existing ? doc(db, 'posts', existing.id) : doc(collection(db, 'posts'));
        batch.set(target, data, { merge: true });
        if (existing) updated += 1;
        else created += 1;
      });

      await batch.commit();
      await loadNews();
      setBulkImportJson('');
      showToast(`นำเข้าข่าวสำเร็จ: เพิ่ม ${created} อัปเดต ${updated}`, 'success');
    } catch (error) {
      console.error(error);
      showToast('นำเข้าไม่สำเร็จ กรุณาตรวจรูปแบบไฟล์ JSON', 'error');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleBulkNewsImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await importBulkNewsJson(await file.text());
  };

  const handleEditPost = (p: Post) => {
    setPostId(p.id);
    setNewTitle(p.title || '');
    setNewContent(p.content || '');
    setNewCategory(p.category || 'ข่าวประชาสัมพันธ์');
    setNewDate(p.date || new Date().toISOString().split('T')[0]);
    setNewImageUrl(p.imageUrl || '');
    setNewImageType(p.imageType || 'image');
    setNewAlbumUrl(p.albumUrl || '');
    setNewTiktokUrl(p.tiktokUrl || '');
    setNewFacebookUrl(p.facebookUrl || '');
    setNewWebsiteUrl(p.websiteUrl || '');
    setNewDocumentUrl(p.documentUrl || '');
    setShowAdvancedPostFields(Boolean(p.content || p.tiktokUrl || p.websiteUrl || p.documentUrl));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePost = (id: string) => {
    askConfirm('ยืนยันการลบโพสต์นี้?', async () => {
      try {
        await deleteDoc(doc(db, 'posts', id));
        setPosts(prev => prev.filter(p => p.id !== id));
        showToast('ลบโพสต์แล้ว', 'success');
        await loadNews();
      } catch (err: any) {
        console.error(err);
        showToast('ลบไม่สำเร็จ: ' + (err?.message || ''), 'error');
      }
    });
  };

  // ---------- Personnel ----------
  const resetPersonnelForm = () => {
    setEditingId(null); setPName(''); setPPos(''); setPImage(''); setPIsHead(false);
    setPCat('teacher'); setPWorkGroup('none');
    setPMajor(''); setPPosNum(''); setPPhone(''); setPWebsite(''); setPEmail('');
  };

  const handleSubmitPersonnel = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { 
        name: (pName || '').trim(), 
        position: (pPos || '').trim(), 
        major: (pMajor || '').trim(),
        positionNumber: (pPosNum || '').trim(),
        phone: (pPhone || '').trim(),
        websiteUrl: (pWebsite || '').trim(),
        email: (pEmail || '').trim(),
        category: pCat || 'teacher', 
        workGroup: pWorkGroup || 'none',
        image: (pImage || '').trim(), 
        isHead: Boolean(pIsHead), 
        order: Number(editingId ? personnelList.find(x => x.id === editingId)?.order ?? (personnelList.length + 1) : (personnelList.length + 1)) || 1 
      };
      if (editingId) {
        const personnelRef = doc(db, 'personnel', editingId);
        await setDoc(personnelRef, data, { merge: true });
        setPersonnelList(current => current.map(item => item.id === editingId ? { ...item, ...data } : item));
        showToast('อัปเดตบุคลากรแล้ว', 'success');

        try {
          const studentsRef = doc(db, 'config', 'students_count');
          const studentsSnapshot = await getDoc(studentsRef);
          if (studentsSnapshot.exists() && Array.isArray(studentsSnapshot.data().rows)) {
            const existingPerson = personnelList.find(person => person.id === editingId);
            let changed = false;
            const linkedRows = studentsSnapshot.data().rows.map((row: StudentRow) => {
              const linked = row.teacherId === editingId
                || (!row.teacherId
                  && normalizePersonName(row.teacher) === normalizePersonName(existingPerson?.name));
              if (!linked) return row;
              changed = true;
              return { ...row, teacherId: editingId, teacher: data.name };
            });
            if (changed) {
              await updateDoc(studentsRef, { rows: linkedRows });
              setStudentRows(linkedRows);
            }
          }
        } catch (syncErr) {
          console.warn('Teacher sync to students_count non-fatal error:', syncErr);
        }
      } else {
        const docRef = await addDoc(collection(db, 'personnel'), data);
        setPersonnelList(current => [...current, { id: docRef.id, ...data }]);
        showToast('เพิ่มบุคลากรสำเร็จ', 'success');
      }
      resetPersonnelForm();
      await loadPersonnel();
    } catch (err: any) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ: ' + (err?.message || ''), 'error');
    }
    setLoading(false);
  };

  const handleDeletePersonnel = (id: string) => {
    const person = personnelList.find(item => item.id === id);
    askConfirm(`ยืนยันการลบ ${person?.name || 'รายชื่อนี้'}? ข้อมูลในหน้าบุคลากรและครูประจำชั้นจะอัปเดตพร้อมกัน`, async () => {
      try {
        await deleteDoc(doc(db, 'personnel', id));
        setPersonnelList(current => current.filter(item => item.id !== id));
        if (editingId === id) resetPersonnelForm();
        showToast('ลบรายชื่อแล้ว', 'success');

        try {
          const studentsRef = doc(db, 'config', 'students_count');
          const studentsSnapshot = await getDoc(studentsRef);
          if (studentsSnapshot.exists() && Array.isArray(studentsSnapshot.data().rows)) {
            let changed = false;
            const linkedRows = studentsSnapshot.data().rows.map((row: StudentRow) => {
              const linked = row.teacherId === id
                || (!row.teacherId
                  && normalizePersonName(row.teacher) === normalizePersonName(person?.name));
              if (!linked) return row;
              changed = true;
              return { ...row, teacherId: '', teacher: '' };
            });
            if (changed) {
              await updateDoc(studentsRef, { rows: linkedRows });
              setStudentRows(linkedRows);
            }
          }
        } catch (syncErr) {
          console.warn('Syncing removed teacher non-fatal error:', syncErr);
        }
      } catch (err: any) {
        console.error(err);
        showToast('ลบไม่สำเร็จ: ' + (err?.message || ''), 'error');
      }
    });
  };

  // ---------- Highlights ----------
  const resetHighlightForm = () => {
    setHId(null); setHBadge('Excellence'); setHTitle(''); setHAccent('');
    setHDesc(''); setHBtn('อ่านรายละเอียด'); setHImg(''); setHImgType('image');
  };

  const handleSubmitHighlight = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        badge: (hBadge || 'Excellence').trim(),
        title: (hTitle || '').trim(),
        titleAccent: (hAccent || '').trim(),
        description: (hDesc || '').trim(),
        buttonText: (hBtn || 'อ่านรายละเอียด').trim(),
        imageUrl: (hImg || '').trim(),
        imageType: hImgType || 'image',
        order: Number(hId ? highlights.find(x => x.id === hId)?.order ?? (highlights.length + 1) : (highlights.length + 1)) || 1
      };
      if (hId) {
        await setDoc(doc(db, 'highlights', hId), data, { merge: true });
        setHighlights(current => current.map(item => item.id === hId ? { ...item, ...data } : item));
        showToast('อัปเดตสไลด์แล้ว', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'highlights'), data);
        setHighlights(current => [...current, { id: docRef.id, ...data }]);
        showToast('เพิ่มสไลด์สำเร็จ', 'success');
      }
      resetHighlightForm();
      await loadHighlights();
    } catch (err: any) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ: ' + (err?.message || ''), 'error');
    }
    setLoading(false);
  };

  const handleEditHighlight = (h: Highlight) => {
    setHId(h.id); setHBadge(h.badge || 'Excellence'); setHTitle(h.title || ''); setHAccent(h.titleAccent || '');
    setHDesc(h.description || ''); setHBtn(h.buttonText || 'อ่านรายละเอียด'); setHImg(h.imageUrl || '');
    setHImgType(h.imageType || 'image');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteHighlight = (id: string) => {
    askConfirm('ลบสไลด์นี้?', async () => {
      try {
        await deleteDoc(doc(db, 'highlights', id));
        setHighlights(current => current.filter(x => x.id !== id));
        showToast('ลบสไลด์แล้ว', 'success');
        await loadHighlights();
      } catch (err: any) {
        console.error(err);
        showToast('ลบไม่สำเร็จ: ' + (err?.message || ''), 'error');
      }
    });
  };

  // ---------- Settings ----------
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const cleanSchool = JSON.parse(JSON.stringify(schoolSettings));
      const cleanHome = JSON.parse(JSON.stringify(homeAssets));
      await setDoc(doc(db, 'config', 'school_info'), cleanSchool, { merge: true });
      await setDoc(doc(db, 'config', 'home_assets'), cleanHome, { merge: true });
      showToast('บันทึกการตั้งค่าทั้งหมดแล้ว', 'success');
    } catch (e: any) {
      console.error(e);
      showToast('บันทึกไม่สำเร็จ: ' + (e?.message || ''), 'error');
    }
    setLoading(false);
  };

  // ---------- Content Pages ----------
  const handleSelectPage = async (slug: string) => {
    setSelectedSlug(slug);
    if (!slug) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'pages', slug));
      if (snap.exists()) {
        const d = snap.data();
        setPageTitleText(d.title || '');
        setPageContentText(d.content || '');
        setPageBannerUrl(d.bannerUrl || '');
        setPageBlocks(Array.isArray(d.blocks) ? d.blocks : []);
      } else {
        const staticData = (staticPageContent as any)[slug];
        setPageTitleText(staticData?.title || '');
        setPageContentText(staticData?.content || '');
        setPageBannerUrl('');
        setPageBlocks([]);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSavePageContent = async () => {
    if (!selectedSlug) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'pages', selectedSlug), {
        title: String(pageTitleText || '').trim(),
        content: String(pageContentText || '').trim(),
        bannerUrl: String(pageBannerUrl || '').trim(),
        blocks: pageBlocks || [],
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showToast('อัปเดตหน้าเว็บเรียบร้อย', 'success');
    } catch (err: any) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ: ' + (err?.message || ''), 'error');
    }
    setLoading(false);
  };

  // ---- Block helpers ----
  const newId = () => Math.random().toString(36).slice(2, 10);
  const addBlock = (type: ContentBlock['type']) => {
    const block: ContentBlock =
      type === 'heading' ? { id: newId(), type, text: '' } :
      type === 'paragraph' ? { id: newId(), type, text: '' } :
      type === 'image' ? { id: newId(), type, url: '', caption: '' } :
      { id: newId(), type: 'divider' };
    setPageBlocks([...pageBlocks, block]);
  };
  const updateBlock = (id: string, patch: Partial<ContentBlock>) => {
    setPageBlocks(pageBlocks.map(b => (b.id === id ? { ...b, ...patch } as ContentBlock : b)));
  };
  const removeBlock = (id: string) => setPageBlocks(pageBlocks.filter(b => b.id !== id));
  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = pageBlocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= pageBlocks.length) return;
    const arr = [...pageBlocks];
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setPageBlocks(arr);
  };

  // ---------- Login Screen ----------
  if (authChecking) {
    return (
      <div className="admin-login-layout" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FF6A00 0%, #FFD400 100%)' }}>
        <div className="card shadow-lg p-5 text-center" style={{ maxWidth: '420px', width: '90%', borderRadius: '32px', border: 'none', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)' }}>
          <ShieldCheck size={48} className="text-warning mb-3 mx-auto" style={{ color: '#FF6A01' }} />
          <h3 className="fw-bold">KMD Admin Console</h3>
          <p className="text-muted mb-0">กำลังตรวจสอบสิทธิผู้ใช้งาน...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="admin-login-layout" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FF6A00 0%, #FFD400 100%)' }}>
        <div className="card shadow-lg p-5" style={{ maxWidth: '420px', width: '90%', borderRadius: '32px', border: 'none', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)' }}>
          <div className="text-center mb-4">
            <ShieldCheck size={48} className="text-warning mb-3" style={{ color: '#FF6A01' }} />
            <h3 className="fw-bold">KMD Admin Console</h3>
            <p className="text-muted">เข้าสู่ระบบเพื่อจัดการเว็บไซต์</p>
          </div>
          {loginError && <div className="alert alert-danger p-2 text-center small mb-3">{loginError}</div>}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="btn btn-light border w-100 py-3 rounded-4 fw-bold mb-3 d-flex align-items-center justify-content-center gap-2"
          >
            <ShieldCheck size={18} /> เข้าสู่ระบบด้วย Google
          </button>
          <div className="alert alert-info p-2 text-center small mb-3">
            บัญชีที่เพิ่มจากเมนู “ผู้ใช้และสิทธิ์” ให้เข้าสู่ระบบด้วย Google
          </div>
          <div className="d-flex align-items-center gap-3 mb-3">
            <div style={{ height: 1, background: '#E2E8F0', flex: 1 }} />
            <span className="small text-muted">หรือใช้รหัสผ่าน</span>
            <div style={{ height: 1, background: '#E2E8F0', flex: 1 }} />
          </div>
          <form onSubmit={handleLogin}>
            <input type="text" className="form-control mb-3" placeholder="Username or email" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
            <input type="password" className="form-control mb-4" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="submit" disabled={loading} className="btn w-100 py-3 rounded-4 fw-bold text-white" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', opacity: loading ? 0.8 : 1 }}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabTitle: Record<AdminTab, string> = {
    dashboard: 'ภาพรวมระบบ',
    news: 'จัดการข่าวสาร',
    highlights: 'จัดการ Highlight Slides',
    personnel: 'จัดการข้อมูลบุคลากร',
    'branch-personnel': 'ครูโรงเรียนสาขา',
    contents: 'จัดการเนื้อหาหน้าเว็บ',
    activities: 'ปฏิทินกิจกรรม / วันหยุด',
    students: 'จำนวนนักเรียน',
    timetable: 'ตารางสอน-ตารางเรียน',
    roster: 'รายชื่อนักเรียน (เช็คชื่อ)',
    clubs: 'ชุมนุม / กิจกรรม / ลูกเสือ',
    staff: 'ผู้ใช้และสิทธิ์',
    settings: 'ตั้งค่าระบบ'
  };

  const tabDescription: Record<AdminTab, string> = {
    dashboard: 'เลือกงานที่ต้องการทำจากปุ่มลัดหรือเมนูด้านซ้าย',
    news: 'เพิ่มข่าวจาก Facebook พร้อมรูปปกและลิงก์ที่เกี่ยวข้อง',
    highlights: 'จัดการสไลด์เนื้อหาสำคัญบนหน้าแรก',
    personnel: 'เพิ่ม แก้ไข และเรียงลำดับข้อมูลบุคลากร',
    'branch-personnel': 'ข้อมูลแสดงอย่างเดียว แยกจากบุคลากรโรงเรียนหลัก ไม่นับรวมในสถิติใด ๆ',
    contents: 'แก้ไขข้อความและภาพประกอบในแต่ละหน้าของเว็บไซต์',
    activities: 'เพิ่มกิจกรรม วันสำคัญ และวันหยุดของโรงเรียน',
    students: 'ปรับจำนวนและข้อมูลนักเรียนแยกตามชั้น',
    timetable: 'ดูแลตารางสอนและตารางเรียน',
    roster: 'จัดการรายชื่อนักเรียนสำหรับระบบเช็คชื่อ',
    clubs: 'จัดการชุมนุม กิจกรรม และลูกเสือ',
    staff: 'กำหนดผู้ใช้งานและระดับสิทธิ์ของครู',
    settings: 'แก้ไขข้อมูลพื้นฐานและช่องทางติดต่อของโรงเรียน'
  };

  const sliderCount = posts.filter(p => p.category === 'แบนเนอร์สไลด์หน้าแรก').length;
  const navGroups: { label: string; items: [AdminTab, ReactNode, string][] }[] = [
    {
      label: 'ภาพรวม',
      items: [['dashboard', <Database size={18} key="d" />, 'แดชบอร์ด']]
    },
    {
      label: 'เว็บไซต์',
      items: [
        ['news', <Rss size={18} key="n" />, 'ข่าว & สไลด์ฮีโร่'],
        ['highlights', <Sparkles size={18} key="h" />, 'Highlight Slides'],
        ['personnel', <Users size={18} key="p" />, 'บุคลากร'],
        ['branch-personnel', <Users size={18} key="bp" />, 'ครูโรงเรียนสาขา'],
        ['contents', <Globe size={18} key="c" />, 'เนื้อหาหน้าเว็บ'],
        ['activities', <CalendarIcon size={18} key="a" />, 'ปฏิทินกิจกรรม'],
        ['students', <Users size={18} key="st" />, 'จำนวนนักเรียน'],
      ]
    },
    {
      label: 'งานครู',
      items: [
        ['timetable', <CalendarIcon size={18} key="tt" />, 'ตารางสอน'],
        ['roster', <Users size={18} key="r" />, 'รายชื่อ-เช็คชื่อ'],
        ['clubs', <Users size={18} key="cb" />, 'ชุมนุม-กิจกรรม'],
      ]
    },
    {
      label: 'ระบบ',
      items: [
        ...(canManageUsers ? [['staff', <ShieldCheck size={18} key="sf" />, 'ผู้ใช้และสิทธิ์'] as [AdminTab, ReactNode, string]] : []),
        ['settings', <Settings size={18} key="s" />, 'ตั้งค่า'],
      ]
    },
  ];
  const normalizedPostSearch = postSearch.trim().toLocaleLowerCase('th-TH');
  const filteredPosts = posts.filter(post => {
    const matchesCategory = postCategoryFilter === 'all' || post.category === postCategoryFilter;
    const matchesSearch = !normalizedPostSearch
      || post.title.toLocaleLowerCase('th-TH').includes(normalizedPostSearch)
      || (post.content || '').toLocaleLowerCase('th-TH').includes(normalizedPostSearch);
    return matchesCategory && matchesSearch;
  });
  const postHasPublicMedia = [newImageUrl, newAlbumUrl, newTiktokUrl, newFacebookUrl]
    .some(value => value.trim() !== '');

  return (
    <div className="admin-dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#FFF7ED 0%, #FFFFFF 50%, #FFF7ED 100%)' }}>
      {/* Sidebar */}
      <aside className="admin-sidebar" style={{ width: '280px', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)', borderRight: '1px solid #FFEDD5', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div className="admin-sidebar-brand d-flex align-items-center gap-3 mb-4 px-2">
          <div style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', padding: '10px', borderRadius: '14px' }}>
            <Layout size={22} color="white" />
          </div>
          <h4 className="fw-bold mb-0" style={{ color: '#FF6A01' }}>KMD Console</h4>
        </div>

        {currentStaff && (
          <div className="admin-user-card" style={{ ...GLASS_CARD, padding: '0.9rem', marginBottom: '1.25rem' }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <ShieldCheck size={16} color="#FF6A01" />
              <div className="small fw-bold" style={{ color: '#0F172A' }}>กำลังใช้งาน</div>
            </div>
            <div className="fw-bold text-truncate" style={{ color: '#0F172A' }}>{currentStaff.name}</div>
            <div className="small text-muted text-truncate">{currentStaff.email}</div>
            <span className="badge mt-2" style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
              {roleLabel(currentStaff.role)}
            </span>
          </div>
        )}

        <nav className="admin-nav">
          {navGroups.map(group => (
            <div className="admin-nav-group" key={group.label}>
              <div className="admin-nav-label">{group.label}</div>
              {group.items.map(([key, icon, label]) => (
                <button
                  key={key}
                  className={`admin-nav-button${activeTab === key ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(key)}
                  aria-current={activeTab === key ? 'page' : undefined}
                >
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer mt-auto pt-4">
          <div style={{ ...GLASS_CARD, padding: '0.9rem', marginBottom: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {dbStatus === 'online' && <CheckCircle2 size={18} color="#22C55E" />}
            {dbStatus === 'offline' && <AlertTriangle size={18} color="#EF4444" />}
            {dbStatus === 'checking' && <Database size={18} color="#FB923C" />}
            <div style={{ fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 700 }}>Firestore</div>
              <div style={{ color: '#64748b' }}>{dbStatus === 'online' ? 'เชื่อมต่อแล้ว' : dbStatus === 'offline' ? 'ออฟไลน์' : 'กำลังตรวจสอบ...'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-danger w-100 rounded-3 d-flex align-items-center justify-content-center gap-2 py-2" aria-label="ออกจากระบบ" title="ออกจากระบบ">
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main" style={{ flex: 1, padding: '2.5rem 3rem', overflowY: 'auto' }}>
        <header className="mb-4">
          <h2 className="fw-bold mb-1">{tabTitle[activeTab]}</h2>
          <p className="text-muted mb-0">{tabDescription[activeTab]}</p>
        </header>

        {/* Status Cards */}
        {activeTab === 'dashboard' && (
          <div className="row g-3 mb-4">
            {[
              { label: 'โพสต์ทั้งหมด', val: posts.length, icon: <Rss size={20} />, color: '#FF6A01' },
              { label: 'Hero Slides', val: sliderCount, icon: <ImageIcon size={20} />, color: '#FB923C' },
              { label: 'Highlight Slides', val: highlights.length, icon: <Sparkles size={20} />, color: '#F59E0B' },
              { label: 'บุคลากรทั้งหมด', val: personnelList.length, icon: <Users size={20} />, color: '#EAB308' },
            ].map((s, i) => (
              <div key={i} className="col-md-3 col-6">
                <div className="admin-stat-card">
                  <div>
                    <div className="admin-stat-label">{s.label}</div>
                    <div className="admin-stat-value" style={{ color: s.color }}>{s.val}</div>
                  </div>
                  <div className="admin-stat-icon" style={{ color: s.color }}>{s.icon}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="d-flex flex-column gap-4">
            <section className="admin-dashboard-section">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
                <div>
                  <h5 className="fw-bold mb-1">งานที่ใช้บ่อย</h5>
                  <p className="text-muted small mb-0">เลือกแล้วเริ่มทำงานได้ทันที</p>
                </div>
              </div>
              <div className="admin-quick-actions">
                {[
                  ['news', <Rss size={20} key="q-news" />, 'เพิ่มข่าว', 'Facebook / รูปปก'],
                  ['personnel', <Users size={20} key="q-person" />, 'จัดการบุคลากร', 'รายชื่อและตำแหน่ง'],
                  ['activities', <CalendarIcon size={20} key="q-event" />, 'เพิ่มกิจกรรม', 'ปฏิทินโรงเรียน'],
                  ['staff', <ShieldCheck size={20} key="q-staff" />, 'เพิ่มสิทธิ์ครู', 'บัญชี Google'],
                ].filter(([key]) => key !== 'staff' || canManageUsers).map(([key, icon, label, desc]) => (
                  <button key={key as string} type="button" onClick={() => setActiveTab(key as AdminTab)} className="admin-quick-action">
                    <span className="admin-quick-action-icon">{icon as ReactNode}</span>
                    <span>
                      <strong>{label as string}</strong>
                      <small>{desc as string}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </section>

            <section className="admin-dashboard-section">
            <h5 className="fw-bold mb-2">คู่มือรูปและสื่อ</h5>
            <p className="text-muted mb-4">ใช้เมื่อต้องเพิ่มรูปจาก Google Drive หรืออัลบั้ม Google Photos</p>
            <div className="row g-3">
              <div className="col-md-4">
                <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#FFF7ED', borderLeft: '4px solid #FF6A01', height: '100%' }}>
                  <div className="fw-bold mb-2">วิธีใช้รูปจาก Google Drive</div>
                  <div className="small text-muted" style={{ lineHeight: 1.6 }}>
                    1. อัปโหลดรูปไป Drive<br />
                    2. คลิกขวา &gt; แชร์ (Share)<br />
                    3. เปลี่ยนเป็น <b>Anyone with the link</b><br />
                    4. วางลิงก์ในช่อง URL รูปภาพ
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#FFF7ED', borderLeft: '4px solid #FB923C', height: '100%' }}>
                  <div className="fw-bold mb-2">วิธีใช้อัลบั้ม Google Photos</div>
                  <div className="small text-muted" style={{ lineHeight: 1.6 }}>
                    1. สร้างอัลบั้มใน Google Photos<br />
                    2. กดปุ่มแชร์ (Share) &gt; <b>Create link</b><br />
                    3. คัดลอกลิงก์มาวางในช่องอัลบั้ม<br />
                    4. ระบบจะแสดงปุ่มให้ผู้ชมกดดูรูปทั้งหมด
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div style={{ padding: '1.25rem', borderRadius: '18px', background: '#FFF7ED', borderLeft: '4px solid #F59E0B', height: '100%' }}>
                  <div className="fw-bold mb-2">เคล็ดลับการใช้งาน</div>
                  <div className="small text-muted" style={{ lineHeight: 1.6 }}>
                    - กดปุ่ม <b>"ดูตัวอย่าง"</b> ทุกครั้งก่อนบันทึก<br />
                    - หากเป็นไฟล์ PDF ให้เปลี่ยนโหมดเป็น PDF<br />
                    - รูปปกควรมีขนาดที่ชัดเจน (สัดส่วน 16:9)
                  </div>
                </div>
              </div>
            </div>
            </section>
          </div>
        )}

        {/* News */}
        {activeTab === 'news' && (
          <div className="row g-4">
            <div className="col-lg-5">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <div className="mb-4">
                  <h5 className="fw-bold mb-1">{postId ? 'แก้ไขโพสต์' : 'เพิ่มโพสต์ใหม่'}</h5>
                  <p className="text-muted small mb-0">กรอกประเภท วันที่ หัวข้อ และลิงก์ Facebook ก่อน ส่วนช่องอื่นเลือกใส่ได้</p>
                </div>
                <form onSubmit={handleSubmitPost}>
                  <div className="row g-3 mb-3">
                    <div className="col-sm-7">
                      <label className="form-label small fw-bold">ประเภท</label>
                      <select className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                        <option value="ข่าวประชาสัมพันธ์">ข่าวประชาสัมพันธ์</option>
                        <option value="แบนเนอร์สไลด์หน้าแรก">แบนเนอร์ Hero (Home Slider)</option>
                        <option value="จดหมายข่าว">จดหมายข่าว / E-Newsletter</option>
                        <option value="ผลงานรางวัล">ผลงาน / รางวัล</option>
                      </select>
                    </div>
                    <div className="col-sm-5">
                      <label className="form-label small fw-bold">วันที่</label>
                      <input type="date" className="form-control" value={newDate} onChange={e => setNewDate(e.target.value)} required />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">หัวข้อ</label>
                    <input type="text" className="form-control" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="เช่น ประกาศเปิดภาคเรียน ปีการศึกษา 2569" required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold d-flex align-items-center gap-2">
                      ลิงก์โพสต์ Facebook
                      <span className="badge" style={{ background: '#EFF6FF', color: '#1877F2' }}>แนะนำ</span>
                    </label>
                    <input type="url" className="form-control" value={newFacebookUrl} onChange={e => setNewFacebookUrl(e.target.value)} placeholder="https://www.facebook.com/share/p/..." />
                    <div className="form-text">เว็บไซต์จะสร้างปุ่มเปิดโพสต์จริงให้อัตโนมัติ</div>
                  </div>
                  <DriveImageInput label="รูปปก / PDF (Google Drive)" value={newImageUrl} onChange={setNewImageUrl} fileType={newImageType} onFileTypeChange={setNewImageType} />
                  <GooglePhotosInput label="อัลบั้ม Google Photos (ถ้ามี)" value={newAlbumUrl} onChange={setNewAlbumUrl} placeholder="https://photos.app.goo.gl/..." />

                  {postHasPublicMedia && (
                    <div className="mb-3">
                      <PdpaNotice
                        title="ตรวจสอบก่อนเผยแพร่สื่อ"
                        consentKey="kmd_child_media_consent_v1"
                        checkboxLabel="ยืนยันว่ามีความยินยอมหรือฐานกฎหมายที่เหมาะสม และรับทราบการใช้บริการภายนอก"
                        onAcceptedChange={setChildMediaConsentOk}
                      >
                        ตรวจสอบว่ารูปหรือวิดีโอเด็กไม่เปิดเผยข้อมูลเกินจำเป็น และลิงก์ Google/Facebook/TikTok ตั้งค่าเผยแพร่อย่างเหมาะสม
                      </PdpaNotice>
                    </div>
                  )}

                  <button
                    type="button"
                    className="admin-advanced-toggle"
                    aria-expanded={showAdvancedPostFields}
                    onClick={() => setShowAdvancedPostFields(value => !value)}
                  >
                    <span>
                      <strong>ตัวเลือกเพิ่มเติม</strong>
                      <small>คำอธิบาย TikTok เว็บไซต์ และเอกสาร</small>
                    </span>
                    <ChevronDown size={18} style={{ transform: showAdvancedPostFields ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
                  </button>

                  {showAdvancedPostFields && (
                    <div className="admin-advanced-panel">
                      <div className="mb-3">
                        <label className="form-label small fw-bold">เนื้อหาอย่างย่อ</label>
                        <textarea className="form-control" rows={4} value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="ว่างไว้ได้ หากใช้โพสต์ Facebook เป็นแหล่งข่าวหลัก"></textarea>
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-bold">ลิงก์ TikTok</label>
                        <input type="url" className="form-control" value={newTiktokUrl} onChange={e => setNewTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@..." />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small fw-bold">ลิงก์เว็บไซต์เพิ่มเติม</label>
                        <input type="url" className="form-control" value={newWebsiteUrl} onChange={e => setNewWebsiteUrl(e.target.value)} placeholder="https://..." />
                      </div>
                      <div>
                        <label className="form-label small fw-bold">ลิงก์เอกสารเพิ่มเติม</label>
                        <input type="url" className="form-control" value={newDocumentUrl} onChange={e => setNewDocumentUrl(e.target.value)} placeholder="https://..." />
                      </div>
                    </div>
                  )}

                  <div className="admin-form-actions d-flex gap-2">
                    <button type="submit" className="btn text-white flex-grow-1 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} disabled={loading}>
                      <Save size={16} /> {loading ? 'กำลังบันทึก...' : (postId ? 'อัปเดตโพสต์' : 'บันทึกโพสต์')}
                    </button>
                    {postId && (
                      <button type="button" className="btn btn-light border rounded-3" onClick={resetPostForm} aria-label="ยกเลิกการแก้ไข" title="ยกเลิกการแก้ไข">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
            <div className="col-lg-7">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">รายการโพสต์</h5>
                    <div className="small text-muted">พบ {filteredPosts.length} จาก {posts.length} รายการ</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      resetPostForm();
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    เพิ่มโพสต์ใหม่
                  </button>
                </div>
                <div className="admin-bulk-import mb-3">
                  <div>
                    <div className="fw-bold d-flex align-items-center gap-2">
                      <ArrowUp size={17} />
                      นำเข้าข่าวหลายรายการ
                    </div>
                    <div className="small text-muted">
                      รองรับไฟล์ JSON และอัปเดตข่าวเดิมจากลิงก์ Facebook โดยไม่สร้างรายการซ้ำ
                    </div>
                  </div>
                  <label className="admin-bulk-consent">
                    <input
                      type="checkbox"
                      checked={bulkMediaConsentOk}
                      onChange={event => setBulkMediaConsentOk(event.target.checked)}
                    />
                    <span>ยืนยันว่ารูปและข้อความในชุดนี้มีสิทธิ์เผยแพร่บนเว็บไซต์</span>
                  </label>
                  <label
                    className={`btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2 ${bulkImporting ? 'disabled' : ''}`}
                    aria-disabled={bulkImporting}
                  >
                    <ArrowUp size={15} />
                    {bulkImporting ? 'กำลังนำเข้า...' : 'เลือกไฟล์ JSON'}
                    <input
                      type="file"
                      accept="application/json,.json"
                      hidden
                      disabled={bulkImporting}
                      onChange={handleBulkNewsImport}
                    />
                  </label>
                  <div className="admin-bulk-json-paste">
                    <label htmlFor="bulk-news-json" className="small fw-bold">
                      หรือวางข้อมูล JSON
                    </label>
                    <textarea
                      id="bulk-news-json"
                      rows={3}
                      value={bulkImportJson}
                      disabled={bulkImporting}
                      onChange={event => setBulkImportJson(event.target.value)}
                      placeholder='วางข้อมูลรูปแบบ [{"title":"...","date":"2026-07-25"}]'
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={bulkImporting || !bulkImportJson.trim()}
                      onClick={() => void importBulkNewsJson(bulkImportJson)}
                    >
                      <ArrowUp size={15} />
                      นำเข้าข้อมูลที่วาง
                    </button>
                  </div>
                </div>
                <div className="admin-list-filters mb-3">
                  <div className="admin-search-field">
                    <Search size={16} />
                    <input
                      type="search"
                      value={postSearch}
                      onChange={event => setPostSearch(event.target.value)}
                      placeholder="ค้นหาหัวข้อข่าว..."
                      aria-label="ค้นหาโพสต์"
                    />
                  </div>
                  <select
                    value={postCategoryFilter}
                    onChange={event => setPostCategoryFilter(event.target.value)}
                    aria-label="กรองประเภทโพสต์"
                  >
                    <option value="all">ทุกประเภท</option>
                    <option value="ข่าวประชาสัมพันธ์">ข่าวประชาสัมพันธ์</option>
                    <option value="แบนเนอร์สไลด์หน้าแรก">แบนเนอร์ Hero</option>
                    <option value="จดหมายข่าว">จดหมายข่าว</option>
                    <option value="ผลงานรางวัล">ผลงาน / รางวัล</option>
                  </select>
                </div>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead><tr className="small text-muted"><th>วันที่</th><th>ประเภท</th><th>หัวข้อ</th><th style={{ width: 90 }}>จัดการ</th></tr></thead>
                    <tbody>
                      {filteredPosts.map(p => (
                        <tr key={p.id}>
                          <td className="small">{p.date}</td>
                          <td><span className="badge" style={{ background: '#FFF7ED', color: '#FF6A01' }}>{p.category}</span></td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              {p.imageUrl && <DriveImage src={p.imageUrl} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '6px' }} />}
                              <span className="fw-bold small text-truncate" style={{ maxWidth: '220px' }}>{p.title}</span>
                              {p.facebookUrl && <span className="badge d-inline-flex align-items-center gap-1" style={{ background: '#EFF6FF', color: '#1877F2' }}><MessageCircle size={12} /> FB</span>}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm btn-light border" onClick={() => handleEditPost(p)} aria-label={`แก้ไข ${p.title}`} title="แก้ไข"><Edit2 size={14} /></button>
                              <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDeletePost(p.id)} aria-label={`ลบ ${p.title}`} title="ลบ"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredPosts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-4">
                            {posts.length === 0 ? 'ยังไม่มีโพสต์' : 'ไม่พบโพสต์ที่ตรงกับคำค้น'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Highlights */}
        {activeTab === 'highlights' && (
          <div className="row g-4">
            <div className="col-lg-5">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">{hId ? 'แก้ไข Highlight Slide' : 'เพิ่ม Highlight Slide'}</h5>
                <form onSubmit={handleSubmitHighlight}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Badge (ป้ายเล็ก)</label>
                    <input type="text" className="form-control" value={hBadge} onChange={e => setHBadge(e.target.value)} placeholder="เช่น Excellence" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">หัวข้อหลัก</label>
                    <input type="text" className="form-control" value={hTitle} onChange={e => setHTitle(e.target.value)} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">หัวข้อสีส้ม (เน้น)</label>
                    <input type="text" className="form-control" value={hAccent} onChange={e => setHAccent(e.target.value)} placeholder="ก้าวสู่สากล" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">คำอธิบาย</label>
                    <textarea className="form-control" rows={3} value={hDesc} onChange={e => setHDesc(e.target.value)}></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ข้อความปุ่ม</label>
                    <input type="text" className="form-control" value={hBtn} onChange={e => setHBtn(e.target.value)} />
                  </div>
                  <DriveImageInput label="รูปภาพประกอบ / PDF (Google Drive)" value={hImg} onChange={setHImg} fileType={hImgType} onFileTypeChange={setHImgType} />
                  <div className="mb-3">
                    <PdpaNotice
                      title="รูปภาพเด็กบนหน้าแรก"
                      consentKey="kmd_child_media_consent_v1"
                      checkboxLabel="ยืนยันว่ามีความยินยอมหรือฐานกฎหมายที่เหมาะสมก่อนเผยแพร่รูปเด็กในพื้นที่สาธารณะ"
                      onAcceptedChange={setChildMediaConsentOk}
                    >
                      รูปใน Highlight มักแสดงบนหน้าแรกของเว็บไซต์ โปรดตรวจว่าเป็นภาพที่เหมาะสมต่อการเผยแพร่สาธารณะและไม่เปิดเผยข้อมูลเด็กเกินจำเป็น
                    </PdpaNotice>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn text-white flex-grow-1 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} disabled={loading}>
                      <Save size={16} /> {loading ? 'กำลังบันทึก...' : (hId ? 'อัปเดต' : 'เพิ่มสไลด์')}
                    </button>
                    {hId && <button type="button" className="btn btn-light rounded-3" onClick={resetHighlightForm}><X size={18} /></button>}
                  </div>
                </form>
              </div>
            </div>
            <div className="col-lg-7">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">สไลด์ที่แสดงในหน้าแรก ({highlights.length})</h5>
                <div className="d-flex flex-column gap-3">
                  {highlights.map(h => (
                    <div key={h.id} style={{ display: 'flex', gap: '14px', padding: '12px', borderRadius: '16px', border: '1px solid #FFEDD5', background: 'white' }}>
                      <DriveImage src={h.imageUrl} style={{ width: '110px', height: '80px', objectFit: 'cover', borderRadius: '12px' }} />
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="badge" style={{ background: '#FFF7ED', color: '#FF6A01', fontSize: '0.7rem' }}>{h.badge}</span>
                          <small className="text-muted">#{h.order}</small>
                        </div>
                        <div className="fw-bold small text-truncate">{h.title} <span style={{ color: '#FF6A01' }}>{h.titleAccent}</span></div>
                        <div className="text-muted small text-truncate" style={{ maxWidth: '320px' }}>{h.description}</div>
                      </div>
                      <div className="d-flex flex-column gap-1">
                        <button className="btn btn-sm btn-light border" onClick={() => handleEditHighlight(h)}><Edit2 size={14} /></button>
                        <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDeleteHighlight(h.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {highlights.length === 0 && <div className="text-center text-muted py-4">ยังไม่มี Highlight Slide — เพิ่มอันแรกได้เลย</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Personnel */}
        {activeTab === 'personnel' && (
          <div className="row g-4">
            <div className="col-lg-4">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">{editingId ? 'แก้ไขข้อมูล' : 'เพิ่มบุคลากร'}</h5>
                <form onSubmit={handleSubmitPersonnel}>
                  <div className="mb-2 small fw-bold">ประเภทบุคลากร</div>
                  <select className="form-select mb-3" value={pCat} onChange={e => setPCat(e.target.value)}>
                    <option value="director">ผู้บริหาร</option>
                    <option value="board">คณะกรรมการสถานศึกษา</option>
                    <option value="teacher">คณะครูประจำการ</option>
                    <option value="support">สายสนับสนุน/ลูกจ้าง</option>
                  </select>
                  <div className="mb-2 small fw-bold">กลุ่มงาน (ถ้ามี)</div>
                  <select className="form-select mb-3" value={pWorkGroup} onChange={e => setPWorkGroup(e.target.value)}>
                    <option value="none">-- ไม่ระบุกลุ่มงาน --</option>
                    <option value="management">ฝ่ายบริหาร</option>
                    <option value="academic">งานวิชาการ</option>
                    <option value="budget">งานงบประมาณ</option>
                    <option value="personnel">งานบุคคล</option>
                    <option value="general">งานทั่วไป</option>
                    <option value="student">กิจการนักเรียน</option>
                  </select>
                  <input type="text" className="form-control mb-3" placeholder="ชื่อ-นามสกุล" value={pName} onChange={e => setPName(e.target.value)} required />
                  <input type="text" className="form-control mb-3" placeholder="ชื่อตำแหน่ง (เช่น ครู, ครูผู้ช่วย)" value={pPos} onChange={e => setPPos(e.target.value)} />
                  <input type="text" className="form-control mb-3" placeholder="กลุ่มวิชาเอก" value={pMajor} onChange={e => setPMajor(e.target.value)} />
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <input type="text" className="form-control" placeholder="เลขที่ตำแหน่ง" value={pPosNum} onChange={e => setPPosNum(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <input type="text" className="form-control" placeholder="เบอร์โทรศัพท์" value={pPhone} onChange={e => setPPhone(e.target.value)} />
                    </div>
                  </div>
                  <input type="url" className="form-control mb-3" placeholder="ลิงก์เว็บไซต์ครู (เช่น Google Site, Classroom)" value={pWebsite} onChange={e => setPWebsite(e.target.value)} />
                  <input type="email" className="form-control mb-3" placeholder="อีเมล (ไม่บังคับ)" value={pEmail} onChange={e => setPEmail(e.target.value)} />
                  <DriveImageInput label="รูปบุคลากร (Google Drive)" value={pImage} onChange={setPImage} />
                  <div className="mb-4 form-check"><input type="checkbox" className="form-check-input" id="isHead" checked={pIsHead} onChange={e => setPIsHead(e.target.checked)} /><label className="form-check-label small fw-bold" htmlFor="isHead">เป็นหัวหน้ากลุ่มงาน</label></div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn text-white flex-grow-1 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} disabled={loading}>
                      <Save size={16} /> {editingId ? 'อัปเดต' : 'เพิ่มรายชื่อ'}
                    </button>
                    {editingId && <button type="button" className="btn btn-light rounded-3" onClick={resetPersonnelForm}><X size={18} /></button>}
                  </div>
                </form>
              </div>
            </div>
            <div className="col-lg-8">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">รายชื่อในระบบ ({personnelList.length})</h5>
                <div className="alert alert-light border small mb-3">
                  รายชื่อนี้เป็นข้อมูลหลักของหน้าบุคลากร กลุ่มงาน และครูประจำชั้น ส่วนสิทธิ์ล็อกอินจัดการแยกที่เมนู “ผู้ใช้และสิทธิ์”
                  <br />จำนวนที่แสดงบนหน้าแรกของเว็บนับจากรายชื่อชุดนี้โดยตรง
                </div>
                <PersonnelSync existingNames={personnelList.map(p => p.name)} />
                <div className="row g-3">
                  {personnelList.map(p => (
                    <div key={p.id} className="col-md-6">
                      <div className={`p-3 rounded-4 d-flex gap-3 align-items-center ${p.isHead ? 'border border-warning bg-light' : 'bg-white border'}`}>
                        <DriveImage
                          src={p.image || `/personnel/${p.name}.jpg`}
                          fallback={`/personnel/${p.name}.jpg`}
                          style={{ width: '50px', height: '50px', borderRadius: '12px', objectFit: 'cover', objectPosition: 'center top' }}
                        />
                        <div className="flex-grow-1 overflow-hidden">
                          <div className="fw-bold small text-truncate">{p.name}</div>
                          <div className="text-muted small text-truncate">{p.position}</div>
                          <div className="d-flex gap-1 mt-1">
                            <div className="badge bg-light text-dark border" style={{ fontSize: '9px' }}>{p.category}</div>
                            {p.workGroup && p.workGroup !== 'none' && (
                              <div className="badge border" style={{ fontSize: '9px', background: '#FFF7ED', color: '#FF6A01' }}>{p.workGroup}</div>
                            )}
                          </div>
                        </div>
                        <div className="d-flex flex-column gap-1">
                          <button className="btn btn-sm btn-light border" onClick={() => { 
                            setEditingId(p.id); 
                            setPName(p.name || ''); 
                            setPPos(p.position || ''); 
                            setPMajor(p.major || '');
                            setPPosNum(p.positionNumber || '');
                            setPPhone(p.phone || '');
                            setPWebsite((p as any).websiteUrl || '');
                            setPEmail((p as any).email || '');
                            setPCat(p.category || 'teacher'); 
                            setPWorkGroup(p.workGroup || 'none');
                            setPImage(p.image || ''); 
                            setPIsHead(!!p.isHead); 
                            window.scrollTo({ top: 0, behavior: 'smooth' }); 
                          }}><Edit2 size={12} /></button>
                          <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDeletePersonnel(p.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {personnelList.length === 0 && <div className="col-12 text-center text-muted py-4">ยังไม่มีรายชื่อบุคลากร</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ครูโรงเรียนสาขา — คนละชุดกับบุคลากรด้านบน */}
        {activeTab === 'branch-personnel' && <BranchPersonnelManager />}

        {/* Contents */}
        {activeTab === 'contents' && (
          <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
            <h5 className="fw-bold mb-4">แก้ไขเนื้อหาหน้าเว็บ (รองรับรูป + กล่องข้อความหลายชุด)</h5>
            <div className="row g-4">
              <div className="col-md-4">
                <label className="small fw-bold mb-2">เลือกหน้า</label>
                <select className="form-select" value={selectedSlug} onChange={e => handleSelectPage(e.target.value)}>
                  <option value="">-- เลือกหน้าที่ต้องการแก้ไข --</option>
                  <optgroup label="ข้อมูลองค์กร">
                    <option value="history">ประวัติโรงเรียน</option>
                    <option value="vision">วิสัยทัศน์ พันธกิจ</option>
                    <option value="symbols">สัญลักษณ์ อัตลักษณ์</option>
                    <option value="song">เพลงประจำโรงเรียน</option>
                    <option value="campus">อาคารสถานที่</option>
                    <option value="contact">แผนที่และติดต่อ</option>
                  </optgroup>
                  <optgroup label="สารสนเทศ">
                    <option value="students">จำนวนนักเรียน</option>
                    <option value="academic-results">ผลสัมฤทธิ์ทางการเรียน</option>
                  </optgroup>
                </select>

                {selectedSlug && (
                  <div className="mt-4">
                    <div className="fw-bold small mb-2">เพิ่มบล็อกเนื้อหา</div>
                    <div className="d-flex flex-column gap-2">
                      <button className="btn btn-light border rounded-3 d-flex align-items-center gap-2" onClick={() => addBlock('heading')}><Type size={16} /> หัวข้อย่อย</button>
                      <button className="btn btn-light border rounded-3 d-flex align-items-center gap-2" onClick={() => addBlock('paragraph')}><AlignLeft size={16} /> กล่องข้อความ</button>
                      <button className="btn btn-light border rounded-3 d-flex align-items-center gap-2" onClick={() => addBlock('image')}><ImageIcon size={16} /> รูปภาพ (Drive)</button>
                      <button className="btn btn-light border rounded-3 d-flex align-items-center gap-2" onClick={() => addBlock('divider')}><Minus size={16} /> เส้นคั่น</button>
                    </div>
                  </div>
                )}
              </div>

              {selectedSlug && (
                <div className="col-md-8">
                  <label className="small fw-bold mb-2">หัวข้อหน้า</label>
                  <input type="text" className="form-control mb-3 fw-bold" value={pageTitleText} onChange={e => setPageTitleText(e.target.value)} placeholder="หัวข้อหน้า" />

                  <DriveImageInput label="รูปแบนเนอร์ของหน้า (เลือกใส่หรือไม่ก็ได้)" value={pageBannerUrl} onChange={setPageBannerUrl} />

                  <div className="mt-3 mb-2 d-flex align-items-center justify-content-between">
                    <label className="small fw-bold mb-0">บล็อกเนื้อหา ({pageBlocks.length})</label>
                    {pageBlocks.length === 0 && <small className="text-muted">ใช้ปุ่ม "เพิ่มบล็อก" ทางซ้าย หรือใส่ข้อความเดิมในกล่องด้านล่าง</small>}
                  </div>

                  <div className="d-flex flex-column gap-3 mb-4">
                    {pageBlocks.map((b, idx) => (
                      <div key={b.id} style={{ border: '1px solid #FFEDD5', borderRadius: '14px', padding: '14px', background: 'white' }}>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge" style={{ background: '#FFF7ED', color: '#FF6A01' }}>
                            {b.type === 'heading' ? 'หัวข้อย่อย' : b.type === 'paragraph' ? 'ข้อความ' : b.type === 'image' ? 'รูปภาพ' : 'เส้นคั่น'} #{idx + 1}
                          </span>
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-light border" disabled={idx === 0} onClick={() => moveBlock(b.id, -1)}><ArrowUp size={12} /></button>
                            <button className="btn btn-sm btn-light border" disabled={idx === pageBlocks.length - 1} onClick={() => moveBlock(b.id, 1)}><ArrowDown size={12} /></button>
                            <button className="btn btn-sm btn-light border text-danger" onClick={() => removeBlock(b.id)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                        {b.type === 'heading' && (
                          <input type="text" className="form-control fw-bold" value={b.text} onChange={e => updateBlock(b.id, { text: e.target.value })} placeholder="พิมพ์หัวข้อย่อย..." />
                        )}
                        {b.type === 'paragraph' && (
                          <textarea className="form-control" rows={4} value={b.text} onChange={e => updateBlock(b.id, { text: e.target.value })} placeholder="พิมพ์เนื้อหาในกล่องข้อความนี้..."></textarea>
                        )}
                        {b.type === 'image' && (
                          <>
                            <DriveImageInput label="รูปจาก Google Drive" value={b.url} onChange={v => updateBlock(b.id, { url: v })} />
                            <input type="text" className="form-control" value={b.caption || ''} onChange={e => updateBlock(b.id, { caption: e.target.value })} placeholder="คำบรรยายใต้รูป (เลือกใส่)" />
                          </>
                        )}
                        {b.type === 'divider' && <div style={{ borderTop: '2px dashed #FFEDD5', margin: '8px 0' }} />}
                      </div>
                    ))}
                  </div>

                  <details className="mb-4">
                    <summary className="fw-bold small text-muted" style={{ cursor: 'pointer' }}>ข้อความเดิม (Legacy single textarea)</summary>
                    <textarea className="form-control mt-2" rows={6} value={pageContentText} onChange={e => setPageContentText(e.target.value)} placeholder="หากใช้บล็อกด้านบนแล้ว ไม่จำเป็นต้องแก้ตรงนี้"></textarea>
                  </details>

                  <button className="btn text-white px-5 py-2 rounded-3 fw-bold d-flex align-items-center gap-2" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} onClick={handleSavePageContent} disabled={loading}>
                    <Save size={16} /> {loading ? 'กำลังบันทึก...' : 'บันทึกเนื้อหาลง Firebase'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activities */}
        {activeTab === 'activities' && (
          <div className="row g-4">
            <div className="col-lg-5">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">{aId ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}</h5>
                <form onSubmit={handleSubmitActivity}>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="small fw-bold mb-1">วันที่เริ่ม</label>
                      <input type="date" className="form-control" value={aDate} onChange={e => setADate(e.target.value)} required />
                    </div>
                    <div className="col-md-6">
                      <label className="small fw-bold mb-1">ถึงวันที่ (ถ้าหลายวัน)</label>
                      <input type="date" className="form-control" value={aEndDate} onChange={e => setAEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="small fw-bold mb-1">ชื่อกิจกรรม</label>
                    <input type="text" className="form-control" value={aTitle} onChange={e => setATitle(e.target.value)} required placeholder="เช่น ประชุมประจำเดือน" />
                  </div>
                  <div className="mb-3">
                    <label className="small fw-bold mb-1">รายละเอียด</label>
                    <textarea className="form-control" rows={3} value={aDesc} onChange={e => setADesc(e.target.value)}></textarea>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-md-6">
                      <label className="small fw-bold mb-1">เวลา</label>
                      <input type="text" className="form-control" value={aTime} onChange={e => setATime(e.target.value)} placeholder="08:00 - 16:00" />
                    </div>
                    <div className="col-md-6">
                      <label className="small fw-bold mb-1">สถานที่</label>
                      <input type="text" className="form-control" value={aLoc} onChange={e => setALoc(e.target.value)} placeholder="ห้องประชุม" />
                    </div>
                  </div>
                  <div className="row g-2 mb-4 align-items-center">
                    <div className="col-md-6">
                      <label className="small fw-bold mb-1">สีกิจกรรม</label>
                      <input type="color" className="form-control form-control-color" value={aColor} onChange={e => setAColor(e.target.value)} />
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <div className="form-check">
                        <input type="checkbox" className="form-check-input" id="isHoliday" checked={aHoliday} onChange={e => setAHoliday(e.target.checked)} />
                        <label className="form-check-label small fw-bold" htmlFor="isHoliday">เป็นวันหยุด</label>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn text-white flex-grow-1 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} disabled={loading}>
                      <Save size={16} /> {loading ? 'กำลังบันทึก...' : (aId ? 'อัปเดต' : 'เพิ่มกิจกรรม')}
                    </button>
                    {aId && <button type="button" className="btn btn-light rounded-3" onClick={resetActivityForm}><X size={18} /></button>}
                  </div>
                </form>
              </div>
            </div>
            <div className="col-lg-7">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">รายการกิจกรรม ({activities.length})</h5>
                <div className="d-flex flex-column gap-2" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {activities.map(a => (
                    <div key={a.id} style={{ padding: '12px 14px', borderRadius: '12px', background: a.isHoliday ? '#FEE2E2' : '#FFF7ED', borderLeft: `5px solid ${a.isHoliday ? '#EF4444' : (a.color || '#FF6A01')}`, display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ minWidth: '95px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>{a.date}</div>
                        {a.endDate && <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>→ {a.endDate}</div>}
                      </div>
                      <div className="flex-grow-1 overflow-hidden">
                        <div className="fw-bold small">{a.title} {a.isHoliday && <span className="badge bg-danger ms-1" style={{ fontSize: '0.65rem' }}>วันหยุด</span>}</div>
                        {a.description && <div className="text-muted small text-truncate">{a.description}</div>}
                      </div>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-light border" onClick={() => handleEditActivity(a)}><Edit2 size={12} /></button>
                        <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDeleteActivity(a.id)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                  {activities.length === 0 && <div className="text-center text-muted py-4">ยังไม่มีกิจกรรม</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Students Count */}
        {activeTab === 'students' && (
          <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
            <div className="row g-3 mb-3">
              <div className="col-md-7">
                <label className="small fw-bold mb-1">หัวข้อ</label>
                <input type="text" className="form-control" value={studentsTitle} onChange={e => setStudentsTitle(e.target.value)} />
              </div>
              <div className="col-md-5">
                <label className="small fw-bold mb-1">คำอธิบายย่อย (ปีการศึกษา/รอบ)</label>
                <input type="text" className="form-control" value={studentsSubtitle} onChange={e => setStudentsSubtitle(e.target.value)} />
              </div>
            </div>

            <div className="table-responsive" style={{ borderRadius: 12, border: '1px solid #FFEDD5' }}>
              <table className="table table-sm align-middle mb-0" style={{ background: 'white' }}>
                <thead style={{ background: '#FFF7ED' }}>
                  <tr>
                    <th style={{ width: '20%' }}>ชั้น</th>
                    <th style={{ width: '8%' }}>ชาย</th>
                    <th style={{ width: '8%' }}>หญิง</th>
                    <th style={{ width: '8%' }}>รวม</th>
                    <th>ครูประจำชั้น</th>
                    <th style={{ width: '15%' }}>หมายเหตุ</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((r, i) => (
                    <tr key={i}>
                      <td><input className="form-control form-control-sm" value={r.class} onChange={e => updateStudentRow(i, 'class', e.target.value)} /></td>
                      <td><input type="number" min="0" className="form-control form-control-sm" value={r.male} onChange={e => updateStudentRow(i, 'male', Number(e.target.value))} /></td>
                      <td><input type="number" min="0" className="form-control form-control-sm" value={r.female} onChange={e => updateStudentRow(i, 'female', Number(e.target.value))} /></td>
                      <td className="fw-bold text-center" style={{ color: '#FF6A01' }}>{(r.male || 0) + (r.female || 0)}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={r.teacherId || personnelList.find(person => normalizePersonName(person.name) === normalizePersonName(r.teacher))?.id || ''}
                          onChange={e => {
                            const person = personnelList.find(item => item.id === e.target.value);
                            setStudentRows(rows => rows.map((row, index) => index === i
                              ? { ...row, teacherId: person?.id || '', teacher: person?.name || '' }
                              : row));
                          }}
                        >
                          <option value="">-- ยังไม่ระบุ --</option>
                          {personnelList
                            .filter(person => person.category === 'teacher' || person.category === 'director')
                            .map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                        </select>
                      </td>
                      <td><input className="form-control form-control-sm" value={r.note} onChange={e => updateStudentRow(i, 'note', e.target.value)} /></td>
                      <td><button className="btn btn-sm btn-light text-danger" onClick={() => removeStudentRow(i)}><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                  <tr style={{ background: '#FFF7ED' }}>
                    <td className="fw-bold">รวมทั้งสิ้น</td>
                    <td className="fw-bold">{studentRows.reduce((s, r) => s + (Number(r.male) || 0), 0)}</td>
                    <td className="fw-bold">{studentRows.reduce((s, r) => s + (Number(r.female) || 0), 0)}</td>
                    <td className="fw-bold" style={{ color: '#FF6A01' }}>
                      {studentRows.reduce((s, r) => s + (Number(r.male) || 0) + (Number(r.female) || 0), 0)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-light border" onClick={addStudentRow}>+ เพิ่มแถว</button>
              <button className="btn btn-warning fw-bold d-flex align-items-center gap-2" style={{ background: '#FDE047', color: '#854D0E', border: 'none' }} onClick={syncFromRoster} disabled={loading}>
                <RefreshCw size={16} /> ดึงยอดจำนวนจากรายชื่อเช็คชื่อ
              </button>
              <button className="btn text-white fw-bold ms-auto" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} onClick={saveStudents} disabled={loading}>
                <Save size={16} className="me-2" /> {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลนักเรียน'}
              </button>
            </div>
          </div>
        )}

        {/* Timetable embed */}
        {activeTab === 'timetable' && (
          <div style={{ ...GLASS_CARD, padding: '1.5rem' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h5 className="fw-bold mb-1">📅 โปรแกรมจัดการตารางสอน</h5>
                <p className="text-muted small mb-0">แก้ไขข้อมูลกลางของโรงเรียน นักเรียนและผู้ปกครองจะเห็นข้อมูลล่าสุดจากหน้าเดียวกัน</p>
              </div>
              <div className="d-flex gap-2">
                <a href="/page/timetable" target="_blank" rel="noreferrer" className="btn btn-outline-primary fw-bold">
                  <ExternalLink size={14} className="me-1" /> ดูหน้าตารางบนเว็บไซต์
                </a>
              </div>
            </div>
            <TimetableSmart />
            <div className="alert alert-success small mt-3 mb-0">
              <b>ข้อมูลเชื่อมกันแล้ว:</b> ตารางนี้บันทึกใน Firestore กลาง ไม่ผูกกับคอมพิวเตอร์เครื่องใดเครื่องหนึ่ง กด Export JSON เมื่อต้องการเก็บไฟล์สำรองเพิ่มเติม
            </div>
          </div>
        )}

        {/* Roster — students for attendance system */}
        {activeTab === 'roster' && (
          <div style={{ ...GLASS_CARD, padding: '1.5rem' }}>
            <div className="mb-3">
              <h5 className="fw-bold mb-1">📋 รายชื่อนักเรียน (สำหรับระบบเช็คชื่อ)</h5>
              <p className="text-muted small mb-0">เพิ่ม/แก้ไข/นำเข้ารายชื่อนักเรียนของแต่ละชั้น — ใช้ในหน้า /attendance</p>
            </div>
            <RosterManager />
          </div>
        )}
        {/* Clubs / Activities / Scouts */}
        {activeTab === 'clubs' && (
          <div style={{ ...GLASS_CARD, padding: '1.5rem' }}>
            <div className="mb-3">
              <h5 className="fw-bold mb-1">🎯 ชุมนุม / กิจกรรม / ลูกเสือ</h5>
              <p className="text-muted small mb-0">สร้างชุมนุม → เพิ่มสมาชิกข้ามชั้น → ครูเช็คชื่อที่หน้า /club-attendance</p>
            </div>
            <ClubsManager />
          </div>
        )}
        {/* Staff users */}
        {activeTab === 'staff' && canManageUsers && (
          <div className="row g-4">
            <div className="col-lg-4">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-3">{editingStaffEmail ? 'แก้ไขสิทธิ์ผู้ใช้' : 'เพิ่ม Gmail ครู/ผู้ดูแล'}</h5>
                <form onSubmit={handleSubmitStaff}>
                  <label className="small fw-bold mb-2">Gmail / อีเมล</label>
                  <input
                    type="email"
                    className="form-control mb-3"
                    placeholder="teacher@gmail.com"
                    value={staffEmail}
                    onChange={e => setStaffEmail(e.target.value)}
                    disabled={!!editingStaffEmail}
                    required
                  />

                  <label className="small fw-bold mb-2">ชื่อที่แสดงในระบบ</label>
                  <input
                    type="text"
                    className="form-control mb-3"
                    placeholder="ชื่อครูหรือผู้ดูแล"
                    value={staffName}
                    onChange={e => setStaffName(e.target.value)}
                  />

                  <label className="small fw-bold mb-2">ระดับสิทธิ์</label>
                  <select className="form-select mb-3" value={staffRole} onChange={e => setStaffRole(e.target.value as StaffManageRole)}>
                    {STAFF_ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>{STAFF_ROLE_LABELS[role]}</option>
                    ))}
                  </select>

                  <label className="d-flex align-items-center gap-2 mb-4 small fw-bold" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      className="form-check-input m-0"
                      checked={staffActive}
                      onChange={e => setStaffActive(e.target.checked)}
                    />
                    เปิดใช้งานบัญชีนี้
                  </label>

                  <div className="d-flex gap-2">
                    <button type="submit" disabled={loading} className="btn text-white fw-bold flex-grow-1 rounded-3" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }}>
                      <Save size={16} className="me-2" /> {loading ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
                    </button>
                    {editingStaffEmail && (
                      <button type="button" className="btn btn-light rounded-3" onClick={resetStaffForm}>
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            <div className="col-lg-8">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                  <div>
                    <h5 className="fw-bold mb-1">รายชื่อผู้มีสิทธิ์เข้าใช้งาน</h5>
                    <div className="small text-muted">อีเมลในรายการนี้ใช้ล็อกอิน Google/Firebase และถูกตรวจซ้ำด้วย Firestore Rules</div>
                  </div>
                  <button className="btn btn-light border rounded-3 d-flex align-items-center gap-2" onClick={loadStaffUsers} disabled={loading}>
                    <RefreshCw size={15} /> โหลดใหม่
                  </button>
                </div>

                <div className="table-responsive" style={{ borderRadius: 14, border: '1px solid #FFEDD5' }}>
                  <table className="table align-middle mb-0" style={{ background: 'white' }}>
                    <thead style={{ background: '#FFF7ED' }}>
                      <tr>
                        <th>ผู้ใช้</th>
                        <th style={{ width: '130px' }}>สิทธิ์</th>
                        <th style={{ width: '110px' }}>สถานะ</th>
                        <th style={{ width: '120px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffUsers.map(user => {
                        const isCurrentUser = normalizeStaffEmail(user.email) === normalizeStaffEmail(currentStaff?.email || '');
                        return (
                          <tr key={user.id}>
                            <td>
                              <div className="fw-bold">{user.name}</div>
                              <div className="small text-muted">{user.email}</div>
                              {user.updatedAt && <div className="small text-muted">อัปเดตล่าสุด {String(user.updatedAt).slice(0, 10)}</div>}
                            </td>
                            <td>
                              <span className="badge" style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                                {STAFF_ROLE_LABELS[user.role]}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${user.active ? 'bg-success' : 'bg-secondary'}`}>
                                {user.active ? 'ใช้งาน' : 'ปิดอยู่'}
                              </span>
                            </td>
                            <td>
                              <div className="d-flex gap-1 justify-content-end">
                                <button className="btn btn-sm btn-light border" onClick={() => handleEditStaff(user)}>
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDeleteStaff(user.email)} disabled={isCurrentUser}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {staffUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-4">ยังไม่มีรายชื่อผู้ใช้ใน Firestore</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Settings */}
        {activeTab === 'settings' && (
          <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
            <h5 className="fw-bold mb-4">ข้อมูลพื้นฐานโรงเรียน</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="small fw-bold mb-2">ชื่อโรงเรียน</label>
                <input type="text" className="form-control" value={schoolSettings.name} onChange={e => setSchoolSettings({ ...schoolSettings, name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="small fw-bold mb-2">คำขวัญ</label>
                <input type="text" className="form-control" value={schoolSettings.motto} onChange={e => setSchoolSettings({ ...schoolSettings, motto: e.target.value })} />
              </div>
              <div className="col-md-12">
                <label className="small fw-bold mb-2">ที่อยู่</label>
                <textarea className="form-control" rows={2} value={schoolSettings.address} onChange={e => setSchoolSettings({ ...schoolSettings, address: e.target.value })}></textarea>
              </div>
              <div className="col-md-6">
                <label className="small fw-bold mb-2">โทรศัพท์</label>
                <input type="text" className="form-control" value={schoolSettings.phone} onChange={e => setSchoolSettings({ ...schoolSettings, phone: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="small fw-bold mb-2">อีเมลโรงเรียน / PDPA</label>
                <input type="email" className="form-control" value={schoolSettings.email} onChange={e => setSchoolSettings({ ...schoolSettings, email: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="small fw-bold mb-2">Facebook Page</label>
                <input type="text" className="form-control" value={schoolSettings.facebook} onChange={e => setSchoolSettings({ ...schoolSettings, facebook: e.target.value })} />
              </div>
              <div className="col-md-12">
                <DriveImageInput label="โลโก้โรงเรียน (Google Drive)" value={schoolSettings.logoUrl} onChange={v => setSchoolSettings({ ...schoolSettings, logoUrl: v })} />
              </div>

              <hr className="my-4" />
              <h6 className="fw-bold mb-3" style={{ color: '#FF6A01' }}>รูปภาพหน้าแรก (Home Assets)</h6>

              <div className="col-md-12">
                <DriveImageInput label="รูป About (ส่วนแนะนำโรงเรียน)" value={homeAssets.homeAboutImg} onChange={v => setHomeAssets({ ...homeAssets, homeAboutImg: v })} />
              </div>
              <div className="col-md-6">
                <DriveImageInput label="Highlight Image (สำรอง 1)" value={homeAssets.homeHighlight1Img} onChange={v => setHomeAssets({ ...homeAssets, homeHighlight1Img: v })} />
              </div>
              <div className="col-md-6">
                <DriveImageInput label="Highlight Image (สำรอง 2)" value={homeAssets.homeHighlight2Img} onChange={v => setHomeAssets({ ...homeAssets, homeHighlight2Img: v })} />
              </div>
            </div>
            <button className="btn text-white mt-4 px-5 py-2 rounded-3 fw-bold" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} onClick={handleSaveSettings} disabled={loading}>
              {loading ? 'กำลังบันทึก...' : 'อัปเดตข้อมูลทั้งหมด'}
            </button>
          </div>
        )}
      </main>

      {/* Toast */}
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />

      {/* Confirm Modal */}
      {confirmState.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 }}>
          <div style={{ ...GLASS_CARD, padding: '2rem', maxWidth: '420px', width: '90%', background: 'white' }}>
            <div className="d-flex align-items-center gap-3 mb-3">
              <div style={{ background: '#FEE2E2', color: '#EF4444', padding: '12px', borderRadius: '12px' }}><AlertTriangle size={22} /></div>
              <h5 className="fw-bold mb-0">ยืนยันการดำเนินการ</h5>
            </div>
            <p className="text-muted">{confirmState.message}</p>
            <div className="d-flex gap-2 mt-4">
              <button className="btn btn-light flex-grow-1 rounded-3" onClick={() => setConfirmState({ ...confirmState, open: false })}>ยกเลิก</button>
              <button
                className="btn btn-danger flex-grow-1 rounded-3 fw-bold"
                onClick={async () => {
                  const fn = confirmState.onConfirm;
                  setConfirmState({ ...confirmState, open: false });
                  try {
                    await fn();
                  } catch (e: any) {
                    console.error('Confirm error:', e);
                    showToast('เกิดข้อผิดพลาด: ' + (e?.message || ''), 'error');
                  }
                }}
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
