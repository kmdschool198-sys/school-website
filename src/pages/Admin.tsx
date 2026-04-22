import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
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
  Calendar as CalendarIcon
} from 'lucide-react';
import {
  collection, addDoc, getDocs, deleteDoc, doc, orderBy, query,
  updateDoc, setDoc, getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { pageContent as staticPageContent } from '../data/pageContent';
import { getDirectImageUrl, DEFAULT_PLACEHOLDER } from '../utils/imageUtils';
import DriveImageInput from '../components/DriveImageInput';
import GooglePhotosInput from '../components/GooglePhotosInput';
import Toast from '../components/Toast';
import { seedPersonnel } from '../seed_personnel_data';
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

type AdminTab = 'dashboard' | 'news' | 'highlights' | 'personnel' | 'contents' | 'activities' | 'settings';

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

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,237,213,0.9)',
  borderRadius: '24px',
  boxShadow: '0 10px 40px rgba(255,106,1,0.08)'
};

function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const saved = localStorage.getItem('kmd_admin_session');
    if (saved) {
      const expiresAt = parseInt(saved, 10);
      if (Date.now() < expiresAt) return true;
      localStorage.removeItem('kmd_admin_session');
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
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
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageType, setNewImageType] = useState<'image' | 'pdf'>('image');
  const [newAlbumUrl, setNewAlbumUrl] = useState('');
  const [newTiktokUrl, setNewTiktokUrl] = useState('');
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [newDocumentUrl, setNewDocumentUrl] = useState('');

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
    phone: '',
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

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshAll();
  }, [isLoggedIn]);

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
    if (snap.exists()) setSchoolSettings(snap.data() as any);
    const snapHome = await getDoc(doc(db, 'config', 'home_assets'));
    if (snapHome.exists()) setHomeAssets(snapHome.data() as any);
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
        date: aDate, title: aTitle, description: aDesc,
        location: aLoc, time: aTime, isHoliday: aHoliday, color: aColor,
      };
      if (aEndDate) data.endDate = aEndDate;
      if (aId) {
        await updateDoc(doc(db, 'activities', aId), data);
        showToast('อัปเดตกิจกรรมแล้ว', 'success');
      } else {
        await addDoc(collection(db, 'activities'), data);
        showToast('เพิ่มกิจกรรมสำเร็จ', 'success');
      }
      resetActivityForm();
      loadActivities();
    } catch (err) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ', 'error');
    }
    setLoading(false);
  };

  const handleEditActivity = (a: Activity) => {
    setAId(a.id); setADate(a.date); setAEndDate(a.endDate || '');
    setATitle(a.title); setADesc(a.description || ''); setALoc(a.location || '');
    setATime(a.time || ''); setAHoliday(!!a.isHoliday); setAColor(a.color || '#FF6A01');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteActivity = (id: string) => {
    askConfirm('ลบกิจกรรมนี้?', async () => {
      try {
        await deleteDoc(doc(db, 'activities', id));
        showToast('ลบกิจกรรมแล้ว', 'success');
        loadActivities();
      } catch {
        showToast('ลบไม่สำเร็จ', 'error');
      }
    });
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (username === 'adminkmd' && password === '12345678kmd') {
      localStorage.setItem('kmd_admin_session', (Date.now() + 20 * 60 * 1000).toString());
      setIsLoggedIn(true);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kmd_admin_session');
    setIsLoggedIn(false);
  };

  // ---------- Posts ----------
  const resetPostForm = () => {
    setPostId(null); setNewTitle(''); setNewContent(''); setNewImageUrl(''); setNewImageType('image'); 
    setNewAlbumUrl(''); setNewTiktokUrl(''); setNewWebsiteUrl(''); setNewDocumentUrl('');
    setNewCategory('ข่าวประชาสัมพันธ์');
  };

  const handleSubmitPost = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: any = {
        title: newTitle,
        content: newContent,
        category: newCategory,
        imageUrl: newImageUrl,
        imageType: newImageType,
        albumUrl: newAlbumUrl,
        tiktokUrl: newTiktokUrl,
        websiteUrl: newWebsiteUrl,
        documentUrl: newDocumentUrl,
      };
      if (postId) {
        await updateDoc(doc(db, 'posts', postId), data);
        showToast('อัปเดตโพสต์เรียบร้อย', 'success');
      } else {
        data.date = new Date().toISOString().split('T')[0];
        await addDoc(collection(db, 'posts'), data);
        showToast('เพิ่มโพสต์ใหม่สำเร็จ', 'success');
      }
      resetPostForm();
      loadNews();
    } catch (err) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ', 'error');
    }
    setLoading(false);
  };

  const handleEditPost = (p: Post) => {
    setPostId(p.id);
    setNewTitle(p.title);
    setNewContent(p.content || '');
    setNewCategory(p.category || 'ข่าวประชาสัมพันธ์');
    setNewImageUrl(p.imageUrl || '');
    setNewImageType(p.imageType || 'image');
    setNewAlbumUrl(p.albumUrl || '');
    setNewTiktokUrl(p.tiktokUrl || '');
    setNewWebsiteUrl(p.websiteUrl || '');
    setNewDocumentUrl(p.documentUrl || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePost = (id: string) => {
    askConfirm('ยืนยันการลบโพสต์นี้?', async () => {
      try {
        await deleteDoc(doc(db, 'posts', id));
        showToast('ลบโพสต์แล้ว', 'success');
        loadNews();
      } catch {
        showToast('ลบไม่สำเร็จ', 'error');
      }
    });
  };

  // ---------- Personnel ----------
  const resetPersonnelForm = () => {
    setEditingId(null); setPName(''); setPPos(''); setPImage(''); setPIsHead(false);
    setPCat('teacher'); setPWorkGroup('none');
    setPMajor(''); setPPosNum(''); setPPhone('');
  };

  const handleSubmitPersonnel = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = { 
        name: pName, 
        position: pPos, 
        major: pMajor,
        positionNumber: pPosNum,
        phone: pPhone,
        category: pCat, 
        workGroup: pWorkGroup,
        image: pImage, 
        isHead: pIsHead, 
        order: editingId ? personnelList.find(x => x.id === editingId)?.order ?? personnelList.length + 1 : personnelList.length + 1 
      };
      if (editingId) {
        await updateDoc(doc(db, 'personnel', editingId), data);
        showToast('อัปเดตบุคลากรแล้ว', 'success');
      } else {
        await addDoc(collection(db, 'personnel'), data);
        showToast('เพิ่มบุคลากรสำเร็จ', 'success');
      }
      resetPersonnelForm();
      loadPersonnel();
    } catch (err) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ', 'error');
    }
    setLoading(false);
  };

  const handleDeletePersonnel = (id: string) => {
    askConfirm('ยืนยันการลบรายชื่อนี้?', async () => {
      try {
        await deleteDoc(doc(db, 'personnel', id));
        showToast('ลบรายชื่อแล้ว', 'success');
        loadPersonnel();
      } catch {
        showToast('ลบไม่สำเร็จ', 'error');
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
        badge: hBadge, title: hTitle, titleAccent: hAccent,
        description: hDesc, buttonText: hBtn, imageUrl: hImg,
        imageType: hImgType,
        order: hId ? highlights.find(x => x.id === hId)?.order ?? highlights.length + 1 : highlights.length + 1
      };
      if (hId) {
        await updateDoc(doc(db, 'highlights', hId), data);
        showToast('อัปเดตสไลด์แล้ว', 'success');
      } else {
        await addDoc(collection(db, 'highlights'), data);
        showToast('เพิ่มสไลด์สำเร็จ', 'success');
      }
      resetHighlightForm();
      loadHighlights();
    } catch (err) {
      console.error(err);
      showToast('บันทึกไม่สำเร็จ', 'error');
    }
    setLoading(false);
  };

  const handleEditHighlight = (h: Highlight) => {
    setHId(h.id); setHBadge(h.badge); setHTitle(h.title); setHAccent(h.titleAccent);
    setHDesc(h.description); setHBtn(h.buttonText); setHImg(h.imageUrl);
    setHImgType(h.imageType || 'image');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteHighlight = (id: string) => {
    askConfirm('ลบสไลด์นี้?', async () => {
      try {
        await deleteDoc(doc(db, 'highlights', id));
        showToast('ลบสไลด์แล้ว', 'success');
        loadHighlights();
      } catch {
        showToast('ลบไม่สำเร็จ', 'error');
      }
    });
  };

  // ---------- Settings ----------
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, 'config', 'school_info'), schoolSettings);
      await setDoc(doc(db, 'config', 'home_assets'), homeAssets);
      showToast('บันทึกการตั้งค่าทั้งหมดแล้ว', 'success');
    } catch (e) {
      console.error(e);
      showToast('บันทึกไม่สำเร็จ', 'error');
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
        title: pageTitleText,
        content: pageContentText,
        bannerUrl: pageBannerUrl,
        blocks: pageBlocks,
        updatedAt: new Date().toISOString()
      });
      showToast('อัปเดตหน้าเว็บเรียบร้อย', 'success');
    } catch {
      showToast('บันทึกไม่สำเร็จ', 'error');
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
  if (!isLoggedIn) {
    return (
      <div className="admin-login-layout" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FF6A00 0%, #FFD400 100%)' }}>
        <div className="card shadow-lg p-5" style={{ maxWidth: '420px', width: '90%', borderRadius: '32px', border: 'none', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)' }}>
          <div className="text-center mb-4">
            <ShieldCheck size={48} className="text-warning mb-3" style={{ color: '#FF6A01' }} />
            <h3 className="fw-bold">KMD Admin Console</h3>
            <p className="text-muted">เข้าสู่ระบบเพื่อจัดการเว็บไซต์</p>
          </div>
          {loginError && <div className="alert alert-danger p-2 text-center small mb-3">รหัสผ่านไม่ถูกต้อง</div>}
          <form onSubmit={handleLogin}>
            <input type="text" className="form-control mb-3" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
            <input type="password" className="form-control mb-4" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="btn w-100 py-3 rounded-4 fw-bold text-white" style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }}>Login</button>
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
    contents: 'จัดการเนื้อหาหน้าเว็บ',
    activities: 'ปฏิทินกิจกรรม / วันหยุด',
    settings: 'ตั้งค่าระบบ'
  };

  const sliderCount = posts.filter(p => p.category === 'แบนเนอร์สไลด์หน้าแรก').length;

  return (
    <div className="admin-dashboard-layout" style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg,#FFF7ED 0%, #FFFFFF 50%, #FFF7ED 100%)' }}>
      {/* Sidebar */}
      <aside style={{ width: '280px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderRight: '1px solid #FFEDD5', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div className="d-flex align-items-center gap-3 mb-5 px-2">
          <div style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', padding: '10px', borderRadius: '14px' }}>
            <Layout size={22} color="white" />
          </div>
          <h4 className="fw-bold mb-0" style={{ color: '#FF6A01' }}>KMD Console</h4>
        </div>

        <nav className="d-flex flex-column gap-2">
          {([
            ['dashboard', <Database size={18} key="d" />, 'แดชบอร์ด'],
            ['news', <Rss size={18} key="n" />, 'ข่าว & สไลด์เฮียร์โร'],
            ['highlights', <Sparkles size={18} key="h" />, 'Highlight Slides'],
            ['personnel', <Users size={18} key="p" />, 'บุคลากร'],
            ['contents', <Globe size={18} key="c" />, 'เนื้อหาหน้าเว็บ'],
            ['activities', <CalendarIcon size={18} key="a" />, 'ปฏิทินกิจกรรม'],
            ['settings', <Settings size={18} key="s" />, 'ตั้งค่า'],
          ] as [AdminTab, ReactNode, string][]).map(([key, icon, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '0.85rem 1rem', borderRadius: '12px',
                border: 'none', textAlign: 'left',
                background: activeTab === key ? 'linear-gradient(135deg,#FF6A01,#FB923C)' : 'transparent',
                color: activeTab === key ? 'white' : '#475569',
                fontWeight: 700, fontSize: '0.92rem',
                boxShadow: activeTab === key ? '0 8px 20px rgba(255,106,1,0.25)' : 'none',
                transition: 'all 0.25s ease'
              }}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4">
          <div style={{ ...GLASS_CARD, padding: '0.9rem', marginBottom: '0.75rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {dbStatus === 'online' && <CheckCircle2 size={18} color="#22C55E" />}
            {dbStatus === 'offline' && <AlertTriangle size={18} color="#EF4444" />}
            {dbStatus === 'checking' && <Database size={18} color="#FB923C" />}
            <div style={{ fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 700 }}>Firestore</div>
              <div style={{ color: '#64748b' }}>{dbStatus === 'online' ? 'Connected' : dbStatus === 'offline' ? 'Offline' : 'Checking...'}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-danger w-100 rounded-3 d-flex align-items-center justify-content-center gap-2 py-2">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '2.5rem 3rem', overflowY: 'auto' }}>
        <header className="mb-4">
          <h2 className="fw-bold mb-1">{tabTitle[activeTab]}</h2>
          <p className="text-muted mb-0">ปรับปรุงข้อมูลเรียลไทม์ลง Firebase Firestore</p>
        </header>

        {/* Status Cards (always visible) */}
        <div className="row g-3 mb-4">
          {[
            { label: 'โพสต์ทั้งหมด', val: posts.length, icon: <Rss size={20} />, color: '#FF6A01' },
            { label: 'Hero Slides', val: sliderCount, icon: <ImageIcon size={20} />, color: '#FB923C' },
            { label: 'Highlight Slides', val: highlights.length, icon: <Sparkles size={20} />, color: '#F59E0B' },
            { label: 'บุคลากร', val: personnelList.length, icon: <Users size={20} />, color: '#FFD400' },
          ].map((s, i) => (
            <div key={i} className="col-md-3 col-6">
              <div style={{ ...GLASS_CARD, padding: '1.25rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: s.color, lineHeight: 1.1, marginTop: '4px' }}>{s.val}</div>
                </div>
                <div style={{ background: '#FFF7ED', color: s.color, padding: '14px', borderRadius: '14px' }}>{s.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div style={{ ...GLASS_CARD, padding: '2rem' }}>
            <h5 className="fw-bold mb-3">ยินดีต้อนรับสู่ KMD Admin</h5>
            <p className="text-muted mb-4">ใช้เมนูด้านซ้ายเพื่อจัดการเนื้อหา ทุกฟอร์มที่ใส่รูปจะรองรับลิงก์ Google Drive และ Google Photos พร้อมระบบดูตัวอย่าง</p>
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

            <div className="mt-4 p-4 rounded-4 shadow-sm" style={{ background: '#FFF7ED', border: '1px solid #FFEDD5' }}>
              <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)', padding: '12px', borderRadius: '12px' }}>
                  <Database size={24} color="white" />
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: '#C2410C' }}>เครื่องมือกรอกข้อมูลอัตโนมัติ</h5>
                  <p className="small text-muted mb-0">ระบบจะช่วยกรอกข้อมูลรายชื่อครูทั้ง 20 ท่านตามไฟล์ Excel ให้คุณทันที</p>
                </div>
              </div>
              <button className="btn btn-warning fw-bold px-4 py-2 rounded-3 shadow-sm d-flex align-items-center gap-2" 
                onClick={async () => {
                  if(window.confirm('ยืนยันการกรอกข้อมูล 20 รายชื่อลงฐานข้อมูล? (รูปภาพต้องมาใส่เองภายหลัง)')) {
                    setLoading(true);
                    try {
                      await seedPersonnel();
                      showToast('กรอกข้อมูล 20 ท่านสำเร็จแล้วครับ!', 'success');
                      loadPersonnel(); // Refresh the personnel list count
                    } catch (e) {
                      showToast('เกิดข้อผิดพลาดในการกรอกข้อมูล', 'error');
                    }
                    setLoading(false);
                  }
                }} disabled={loading}>
                {loading ? 'กำลังกรอกข้อมูล...' : '🚀 เริ่มกรอกข้อมูลครู 20 ท่าน (Auto-Seed)'}
              </button>
            </div>
          </div>
        )}

        {/* News */}
        {activeTab === 'news' && (
          <div className="row g-4">
            <div className="col-lg-5">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">{postId ? 'แก้ไขโพสต์' : 'เพิ่มโพสต์ใหม่'}</h5>
                <form onSubmit={handleSubmitPost}>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ประเภท</label>
                    <select className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                      <option value="ข่าวประชาสัมพันธ์">ข่าวประชาสัมพันธ์</option>
                      <option value="แบนเนอร์สไลด์หน้าแรก">แบนเนอร์ Hero (Home Slider)</option>
                      <option value="จดหมายข่าว">จดหมายข่าว / E-Newsletter</option>
                      <option value="ผลงานรางวัล">ผลงาน / รางวัล</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">หัวข้อ</label>
                    <input type="text" className="form-control" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
                  </div>
                  <DriveImageInput label="URL รูปภาพ / PDF (Google Drive)" value={newImageUrl} onChange={setNewImageUrl} fileType={newImageType} onFileTypeChange={setNewImageType} />
                   <GooglePhotosInput label="ลิงก์อัลบั้ม Google Photos (แชร์เป็นสาธารณะ)" value={newAlbumUrl} onChange={setNewAlbumUrl} placeholder="https://photos.app.goo.gl/..." />
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ลิงก์ TikTok</label>
                    <input type="text" className="form-control" value={newTiktokUrl} onChange={e => setNewTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@..." />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ลิงก์เว็บไซต์เพิ่มเติม</label>
                    <input type="text" className="form-control" value={newWebsiteUrl} onChange={e => setNewWebsiteUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">ลิงก์เอกสารเพิ่มเติม</label>
                    <input type="text" className="form-control" value={newDocumentUrl} onChange={e => setNewDocumentUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">เนื้อหาอย่างย่อ</label>
                    <textarea className="form-control" rows={4} value={newContent} onChange={e => setNewContent(e.target.value)}></textarea>
                  </div>
                  <div className="d-flex gap-2">
                    <button type="submit" className="btn text-white flex-grow-1 py-2 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#FF6A01,#FB923C)' }} disabled={loading}>
                      <Save size={16} /> {loading ? 'กำลังบันทึก...' : (postId ? 'อัปเดตโพสต์' : 'บันทึกโพสต์')}
                    </button>
                    {postId && <button type="button" className="btn btn-light rounded-3" onClick={resetPostForm}><X size={18} /></button>}
                  </div>
                </form>
              </div>
            </div>
            <div className="col-lg-7">
              <div style={{ ...GLASS_CARD, padding: '1.75rem' }}>
                <h5 className="fw-bold mb-4">รายการโพสต์ทั้งหมด ({posts.length})</h5>
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead><tr className="small text-muted"><th>วันที่</th><th>ประเภท</th><th>หัวข้อ</th><th style={{ width: 90 }}>จัดการ</th></tr></thead>
                    <tbody>
                      {posts.map(p => (
                        <tr key={p.id}>
                          <td className="small">{p.date}</td>
                          <td><span className="badge" style={{ background: '#FFF7ED', color: '#FF6A01' }}>{p.category}</span></td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              {p.imageUrl && <img src={getDirectImageUrl(p.imageUrl)} style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '6px' }} />}
                              <span className="fw-bold small text-truncate" style={{ maxWidth: '220px' }}>{p.title}</span>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button className="btn btn-sm btn-light border" onClick={() => handleEditPost(p)}><Edit2 size={14} /></button>
                              <button className="btn btn-sm btn-light border text-danger" onClick={() => handleDeletePost(p.id)}><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {posts.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-4">ยังไม่มีโพสต์</td></tr>}
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
                      <img src={getDirectImageUrl(h.imageUrl) || DEFAULT_PLACEHOLDER} style={{ width: '110px', height: '80px', objectFit: 'cover', borderRadius: '12px' }} />
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
                <div className="row g-3">
                  {personnelList.map(p => (
                    <div key={p.id} className="col-md-6">
                      <div className={`p-3 rounded-4 d-flex gap-3 align-items-center ${p.isHead ? 'border border-warning bg-light' : 'bg-white border'}`}>
                        <img src={getDirectImageUrl(p.image) || DEFAULT_PLACEHOLDER} style={{ width: '50px', height: '50px', borderRadius: '12px', objectFit: 'cover' }} />
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
                            setPName(p.name); 
                            setPPos(p.position); 
                            setPMajor(p.major || '');
                            setPPosNum(p.positionNumber || '');
                            setPPhone(p.phone || '');
                            setPCat(p.category); 
                            setPWorkGroup(p.workGroup || 'none');
                            setPImage(p.image); 
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
              <button className="btn btn-danger flex-grow-1 rounded-3 fw-bold" onClick={() => { confirmState.onConfirm(); setConfirmState({ ...confirmState, open: false }); }}>ลบ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
