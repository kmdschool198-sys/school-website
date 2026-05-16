// One-shot: import club rosters into Firestore `clubs` collection
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDMQ21IocDvKkkgb-3HnHlz9OF4Nc-q7jk",
  authDomain: "web-site-kmd.firebaseapp.com",
  projectId: "web-site-kmd",
  storageBucket: "web-site-kmd.firebasestorage.app",
  messagingSenderId: "1084529861236",
  appId: "1:1084529861236:web:e05c9ba62099c9ff036721"
};

const CLUBS_DATA = [
  {
    name: 'ศิลปะจากเส้นลวด',
    type: 'ชุมนุม',
    advisor: 'นางสาววิมลรัตน์ เจริญธัญญากร',
    description: 'ภาคเรียนที่ 1 ปีการศึกษา 2569',
    students: [
      ['ด.ญ.กชกร แซ่ม้า', 'ม.1'],
      ['ด.ญ.บุญจิรา ธัญชาติไพศาล', 'ม.1'],
      ['ด.ช.ชรัณ พรมจันทร์', 'ป.4'],
      ['ด.ช.ณัฐวัฒน์ จันทร์สิงห์', 'ป.1'],
      ['ด.ช.รพีพัทธ์ ประเสริฐศิลป์', 'ป.6'],
      ['ด.ช.สว่าง หัวบือ', 'ป.6'],
      ['ด.ช.เอกเดชา ตะแก่', 'ป.6'],
      ['ด.ญ.ญาดา สายทอง', 'ป.3'],
      ['ด.ช.อรรถวัฒน์ ศรีสุข', 'ป.3'],
      ['ด.ช.ณัฐวุฒิ ทูลนอก', 'ป.5'],
      ['ด.ญ.สุวภัทร ตลับทอง', 'ม.2'],
      ['ด.ช.กมลภพ วัฒนศิริ', 'ม.3'],
    ],
  },
  {
    name: 'volleyball',
    type: 'ชุมนุม',
    advisor: 'นายอรรถชัย แก้วเอี่ยม, นางสาวธญาภรณ์ คล้ายเพ็ง',
    description: 'ภาคเรียนที่ 1 ปีการศึกษา 2569',
    students: [
      ['ด.ญ.นิชา แซ่โซ้ง', 'ม.1'],
      ['ด.ญ.ณัชชา คงทน', 'ม.1'],
      ['ด.ช.กฤษณชัย แซ่ม้า', 'ม.1'],
      ['ด.ช.ธนวัฒน์ สุขเสริม', 'ป.6'],
      ['ด.ญ.กมลชนก ทิพย์อักษร', 'ป.3'],
      ['ด.ช.นฤวัต ใจเมือง', 'ป.3'],
      ['ด.ช.ธิวากร สุราบุตร์', 'ม.3'],
      ['ด.ญ.สุธิดา รัตนาวงค์', 'ม.3'],
      ['ด.ญ.สุวรรณษา นาน้อง', 'ม.3'],
      ['ด.ญ.กัญญานัท จูมงคล', 'ม.3'],
      ['ด.ช.ชาญชัย สุขจิตร', 'ม.3'],
      ['ด.ช.ณัฐวุฒิ รื่นจิตร', 'ม.3'],
    ],
  },
  {
    name: 'รำไทย.com',
    type: 'ชุมนุม',
    advisor: 'นางสาวไอยรดา อาจจีน, นางสาวธิดารัตน์ แรตสอน',
    description: 'ภาคเรียนที่ 1 ปีการศึกษา 2569',
    students: [
      ['ด.ญ.วราภรณ์ -', 'ม.1'],
      ['ด.ญ.นิรัชพร คำสีเขียว', 'ป.4'],
      ['ด.ญ.ปภาวี จันทมาด', 'ป.4'],
      ['ด.ญ.วิรดา ทองมา', 'ป.3'],
      ['ด.ญ.จิราพัชร หนูอิ่ม', 'ป.3'],
      ['ด.ญ.สาริศา ศรีสุข', 'ป.3'],
      ['ด.ญ.นิภัสสร การบรรจง', 'ป.3'],
      ['ด.ญ.พสิกา เฟื่องจันทร์', 'ป.3'],
    ],
  },
  {
    name: 'ครัวจิ๋ว',
    type: 'ชุมนุม',
    advisor: 'นางสาวณัฐนิชา ภักดี, นางสาวนริศรา ทำจิตรเหมาะ, นางสาวจิราภา พานชัย',
    description: 'ภาคเรียนที่ 1 ปีการศึกษา 2569',
    students: [
      ['ด.ญ.สิริกานต์ เปี่ยมใจ', 'ม.1'],
      ['ด.ญ.พิชญธิดา มาไกล', 'ม.1'],
      ['ด.ญ.สุพิชชา พูลจวง', 'ม.1'],
      ['ด.ญ.ยูบิน รัต', 'ป.4'],
      ['ด.ญ.ญาดา เหวิวิตร', 'ป.4'],
      ['ด.ญ.ปภาดา กาเหลา', 'ป.2'],
      ['ด.ช.อนุพงษ์ สุขศิริ', 'ป.2'],
      ['ด.ช.พีรวัส สุขเสริม', 'ป.2'],
      ['ด.ช.ชนาธิป ภู่ระหงษ์', 'ป.2'],
      ['ด.ญ.สุภัสสรา นุ่มเกิด', 'ป.5'],
      ['ด.ญ.สรัญญา วิจิตรปัญญา', 'ม.3'],
      ['ด.ญ.กัญญาภัทร ขัดสี', 'ม.3'],
      ['ด.ญ.กัญญาภัทร ดานบิน', 'ม.3'],
      ['ด.ญ.ณัฐณิชา แก้วมณี', 'ม.3'],
      ['ด.ญ.ชลดา พันธ์ศรี', 'ม.3'],
    ],
  },
  {
    name: 'เปตอง',
    type: 'ชุมนุม',
    advisor: 'นายพีระ เดชะผล',
    description: 'ภาคเรียนที่ 1 ปีการศึกษา 2569',
    students: [
      ['ด.ช.พัชรพล ภูเด่นตา', 'ม.1'],
      ['ด.ช.นนทพัทธ์ ชาติมนตรี', 'ป.4'],
      ['ด.ช.กิตติภพ แก้วมณี', 'ป.4'],
      ['ด.ช.อเนกคุณ หนูอิ่ม', 'ป.4'],
      ['ด.ช.ณัฐวัฒน์ หมู่ทอง', 'ป.4'],
      ['ด.ช.จิรภัทร ดานบิน', 'ป.6'],
      ['ด.ช.นราวิชญ์ พลอยประดับ', 'ป.6'],
      ['ด.ช.พิธิสักค์ มะลัยไธสงค์', 'ป.6'],
      ['ด.ช.ธณพล ลันทม', 'ป.6'],
      ['ด.ช.ณัฐพล จันทะคุณ', 'ป.6'],
      ['ด.ช.อัครพันธ์ คำสีเขียว', 'ป.3'],
      ['ด.ช.รัชกฤช ทวิราช', 'ป.3'],
      ['ด.ช.ภัทรเดช สุขจิตร', 'ป.5'],
      ['ด.ช.อภิชัย ปูตือ', 'ม.3'],
      ['ด.ช.วงศกร เฟื่องจันทร์', 'ม.3'],
      ['ด.ช.อดิเทพ หมู่ทอง', 'ม.3'],
    ],
  },
  {
    name: 'ชุมนุม (ไม่ระบุชื่อ)',
    type: 'ชุมนุม',
    advisor: '',
    description: 'รายชื่อในต้นฉบับไม่มีหัวข้อชื่อชุมนุม - กรุณาแก้ไขชื่อ + ครูที่ปรึกษา',
    students: [
      ['ด.ช.อนาวิล พลอยประดับ', 'ป.1'],
      ['ด.ช.สิษฐ์กัณฑ์ แสงทองศรี', 'ป.1'],
      ['ด.ช.ภพธร กะวันทา', 'ป.1'],
      ['ด.ช.ชลธร ศรีสุข', 'ป.1'],
      ['ด.ช.กมลโชค ศรีสุข', 'ป.1'],
      ['ด.ช.วรพล มีกัณหา', 'ป.6'],
      ['ด.ช.ณัฐพล เหระวัน', 'ป.6'],
      ['ด.ญ.สุภัสสรา รักไทย', 'ป.6'],
      ['ด.ช.ชูเดช พวงมาลี', 'ม.2'],
      ['ด.ช.ชนาธิป ผาดศรี', 'ป.2'],
      ['ด.ช.รชต ลึบอ', 'ป.2'],
      ['ด.ช.ชนาธิป แสงทองศรี', 'ป.2'],
      ['ด.ช.มนชิต รักกลิ่น', 'ม.3'],
      ['ด.ช.หิน หมื่นหาญ', 'ม.3'],
      ['ด.ช.ก้องภพ แสงทองศรี', 'ม.3'],
      ['ด.ญ.พรชิตา ดันบิน', 'ม.3'],
    ],
  },
  {
    name: 'เสมารักษ์นักพัฒนา',
    type: 'ชุมนุม',
    advisor: 'นายพิศุทธิ์ เชาวลิตโรจน์, นายธิติวุฒิ เตยไธสง, นางสาวอาริษา ฉิมสุพร',
    description: 'ภาคเรียนที่ 1 ปีการศึกษา 2569',
    students: [
      ['ด.ญ.นภรัตน์ รัตนาวงษ์', 'ป.6'],
      ['ด.ญ.ภัทรพร มงคล', 'ป.6'],
      ['ด.ญ.สิริรัตน์ แสงทองศรี', 'ป.6'],
      ['ด.ช.รัชชานนท์ จำปา', 'ป.6'],
      ['ด.ช.เกียรติศักดิ์ ไทรงาม', 'ป.6'],
      ['ด.ช.พีรพล แก้วดี', 'ป.6'],
      ['ด.ช.อินทัช นาหอม', 'ม.2'],
      ['ด.ญ.ธันย์ชนก โพธิ์มณี', 'ม.2'],
      ['ด.ญ.ศิรญา เปี่ยมใจ', 'ม.2'],
      ['ด.ช.ณัฐพล ดีพาชู', 'ม.2'],
      ['ด.ญ.กัญญารัตน์ แก้วมณี', 'ม.2'],
      ['ด.ช.พุฒิพงศ์ คงโพธิ์น้อย', 'ม.2'],
      ['ด.ช.ชัยณรงค์ เหระวัน', 'ม.2'],
      ['ด.ช.ชัชพงษ์ วิจิตรปัญญา', 'ม.2'],
      ['ด.ช.กิตติทัต จันทรคุณ', 'ม.2'],
      ['ด.ช.พัชรกิตต์ ไทรงาม', 'ม.2'],
      ['ด.ญ.เพ็ญพิชชา หมู่ทอง', 'ม.2'],
      ['ด.ช.อนันต์วัฒน์ หมู่ทอง', 'ป.5'],
      ['ด.ช.กิตติพงศ์ ปูตือ', 'ป.5'],
      ['ด.ช.เอกชัย รัตนาวงค์', 'ป.5'],
      ['ด.ญ.พิชญดา พลสามารถ', 'ป.5'],
      ['ด.ญ.วินิดา แสงทองศรี', 'ป.5'],
      ['ด.ญ.เขมิกา ลึบอ', 'ม.1'],
    ],
  },
];

// Normalize Thai names (strip prefixes + spaces) for fuzzy matching
function normalize(name) {
  return name
    .replace(/^(ด\.ช\.|ด\.ญ\.|ด\.ฐ\.|นาย|น\.ส\.|นางสาว|เด็กชาย|เด็กหญิง|นาง)\s*/g, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .trim();
}

(async () => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Load roster
  const rosterSnap = await getDoc(doc(db, 'config', 'attendance_classes'));
  if (!rosterSnap.exists()) { console.error('ไม่พบรายชื่อนักเรียนใน config/attendance_classes'); process.exit(1); }
  const classes = rosterSnap.data().classes;

  // Build name index: classLabel → [{id, code, name, normalized}]
  const indexByClass = {};
  classes.forEach(c => {
    const grade = c.label.split('/')[0]; // "ม.1/1" → "ม.1"
    if (!indexByClass[grade]) indexByClass[grade] = [];
    c.students.forEach(s => {
      indexByClass[grade].push({
        studentId: s.id,
        code: s.code || s.id,
        name: s.name,
        classLabel: c.label,
        normalized: normalize(s.name),
      });
    });
  });

  // Process clubs
  let totalCreated = 0, totalMembers = 0, totalNotFound = 0;
  for (const club of CLUBS_DATA) {
    const members = [];
    const notFound = [];
    for (const [rawName, grade] of club.students) {
      const norm = normalize(rawName);
      const pool = indexByClass[grade] || [];
      // exact match first
      let match = pool.find(s => s.normalized === norm);
      // fuzzy: first 4 chars match (last name)
      if (!match) match = pool.find(s => s.normalized.includes(norm) || norm.includes(s.normalized));
      if (match) {
        members.push({
          studentId: match.studentId,
          code: match.code,
          name: match.name,
          classLabel: match.classLabel,
        });
      } else {
        notFound.push(`${rawName} (${grade})`);
      }
    }
    const id = `club_${club.name.replace(/[^\w฀-๿]/g, '_').slice(0, 30)}_${Date.now()}`;
    const clubDoc = {
      id, name: club.name, type: club.type, advisor: club.advisor,
      description: club.description, members, createdAt: Date.now(),
    };
    await setDoc(doc(db, 'clubs', id), clubDoc);
    totalCreated++;
    totalMembers += members.length;
    totalNotFound += notFound.length;
    console.log(`✓ ${club.name}: matched ${members.length}/${club.students.length}` +
      (notFound.length ? `\n  ⚠️ ไม่พบ: ${notFound.join(', ')}` : ''));
  }

  console.log(`\n✅ สร้าง ${totalCreated} ชุมนุม · จับคู่สมาชิก ${totalMembers} คน · ไม่พบ ${totalNotFound} คน`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
