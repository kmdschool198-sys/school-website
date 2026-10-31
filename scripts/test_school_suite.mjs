import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// -------------------------------------------------------------
// Test Suite 1: School Identity & Metadata Verification
// -------------------------------------------------------------
test('Suite 1: School Metadata & Branding Integrity', async (t) => {
  await t.test('siteLinks.ts should contain correct School Name & Affiliation', () => {
    const siteLinksPath = path.join(rootDir, 'src', 'config', 'siteLinks.ts');
    assert.ok(fs.existsSync(siteLinksPath), 'siteLinks.ts exists');

    const content = fs.readFileSync(siteLinksPath, 'utf-8');
    assert.match(content, /SCHOOL_NAME\s*=\s*['"]โรงเรียนบ้านคลองมดแดง['"]/);
    assert.match(content, /SCHOOL_AFFILIATION\s*=\s*['"]สังกัดสำนักงานเขตพื้นที่การศึกษาประถมศึกษากำแพงเพชร เขต 2['"]/);
    assert.match(content, /SCHOOL_ADDRESS\s*=\s*['"]198 หมู่ 3 ตำบลโป่งน้ำร้อน อำเภอคลองลาน จังหวัดกำแพงเพชร 62180['"]/);
    assert.match(content, /SCHOOL_PHONE\s*=\s*['"]0880998990['"]/);
    assert.match(content, /SCHOOL_EMAIL\s*=\s*['"]kmdschool198@gmail.com['"]/);
  });

  await t.test('Name of another school ("บ้านแม่แดดน้อย") must not appear in src code', () => {
    const srcDir = path.join(rootDir, 'src');
    const otherSchool = /แม่แดดน้อย|Mae\s*Daed/i;
    const foundFiles = [];

    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx?|jsx?|json|css|html)$/.test(entry.name)) {
          const text = fs.readFileSync(fullPath, 'utf-8');
          if (otherSchool.test(text)) {
            foundFiles.push(path.relative(rootDir, fullPath));
          }
        }
      }
    }

    scanDir(srcDir);
    assert.deepEqual(foundFiles, [], `Found another school's name in files: ${foundFiles.join(', ')}`);
  });

  // Everything under src/ ships in the public JS bundle; student personal data belongs in
  // Firestore student_details (staff-only), uploaded from private/ by npm run upload:student-details
  await t.test('No student personal data (PDPA) in src code', () => {
    const forbidden = [
      [/["']?citizenId["']?\s*:\s*["']\d{13}["']/, 'citizen ID'],
      [/(?<![.\w])["']?(guardianName|fatherName|motherName)["']?\s*:\s*["'][^"'\-.]{2,}["']/, 'guardian/parent name'],
      [/บ้านเลขที่\s*\S+\s*หมู่/, 'home address'],
      [/["']?disadvantage["']?\s*:\s*["'][^"'\-]{2,}["']/, 'disadvantage status'],
    ];
    const hits = [];
    function scan(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(fullPath);
        else if (/\.(tsx?|jsx?|json)$/.test(entry.name)) {
          const text = fs.readFileSync(fullPath, 'utf-8');
          for (const [re, label] of forbidden) {
            if (re.test(text)) hits.push(`${path.relative(rootDir, fullPath)} (${label})`);
          }
        }
      }
    }
    scan(path.join(rootDir, 'src'));
    assert.deepEqual(hits, [], `Student personal data found in src: ${hits.join(', ')}`);
  });
});

// -------------------------------------------------------------
// Test Suite 2: Excel & Thai Number Paste Parsing Utilities
// -------------------------------------------------------------
test('Suite 2: Excel Paste & Thai Data Extraction', async (t) => {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

  function parseThaiFloat(value) {
    if (value === null || value === undefined) return null;
    let str = String(value).trim();
    if (!str || str === '-' || str === '—' || str === 'ขาด' || str === 'ลา' || str.toLowerCase() === 'n/a') {
      return null;
    }
    str = str.replace(/[๐-๙]/g, d => String(thaiDigits.indexOf(d)));
    str = str.replace(/,/g, '').replace(/฿|บาท|กก\.?|ซม\.?|ครั้ง|วัน|คะแนน|\s+/g, '');
    const match = str.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const num = parseFloat(match[0]);
    return (Number.isFinite(num) && !Number.isNaN(num)) ? num : null;
  }

  function parseExcelPaste(text) {
    if (!text || typeof text !== 'string') return [];
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    return lines.map(line => line.split('\t').map(c => c.trim()));
  }

  await t.test('parseThaiFloat handles standard numerals and Thai numerals', () => {
    assert.strictEqual(parseThaiFloat('100'), 100);
    assert.strictEqual(parseThaiFloat('๑๐๐'), 100);
    assert.strictEqual(parseThaiFloat('๓.๗๕'), 3.75);
    assert.strictEqual(parseThaiFloat('๑,๒๕๐.๕๐'), 1250.5);
  });

  await t.test('parseThaiFloat strips units (บาท, กก, ซม, etc.) correctly', () => {
    assert.strictEqual(parseThaiFloat('๕๐ บาท'), 50);
    assert.strictEqual(parseThaiFloat('42.5 กก.'), 42.5);
    assert.strictEqual(parseThaiFloat('๑๔๕.๐ ซม.'), 145);
    assert.strictEqual(parseThaiFloat('฿ 2,500'), 2500);
  });

  await t.test('parseThaiFloat handles absent / invalid values gracefully', () => {
    assert.strictEqual(parseThaiFloat('-'), null);
    assert.strictEqual(parseThaiFloat('—'), null);
    assert.strictEqual(parseThaiFloat('ขาด'), null);
    assert.strictEqual(parseThaiFloat('ลา'), null);
    assert.strictEqual(parseThaiFloat('N/A'), null);
    assert.strictEqual(parseThaiFloat(''), null);
  });

  await t.test('parseExcelPaste splits tab-delimited cells and lines', () => {
    const raw = "1\tสมชาย\t85\n2\tสมหญิง\t92\n";
    const matrix = parseExcelPaste(raw);
    assert.strictEqual(matrix.length, 2);
    assert.deepEqual(matrix[0], ['1', 'สมชาย', '85']);
    assert.deepEqual(matrix[1], ['2', 'สมหญิง', '92']);
  });
});

// -------------------------------------------------------------
// Test Suite 3: Academic GPA, Credits & Ranking Calculations
// -------------------------------------------------------------
test('Suite 3: Academic Core Logic & Evaluation', async (t) => {
  function scoreToGrade(score) {
    if (score >= 80) return 4;
    if (score >= 75) return 3.5;
    if (score >= 70) return 3;
    if (score >= 65) return 2.5;
    if (score >= 60) return 2;
    if (score >= 55) return 1.5;
    if (score >= 50) return 1;
    return 0;
  }

  function calculateGPA(subjects) {
    let totalGradePoints = 0;
    let totalCredits = 0;
    for (const sub of subjects) {
      if (typeof sub.grade === 'number' && !isNaN(sub.grade)) {
        totalGradePoints += sub.grade * sub.credits;
        totalCredits += sub.credits;
      }
    }
    return totalCredits > 0 ? parseFloat((totalGradePoints / totalCredits).toFixed(2)) : 0;
  }

  function calculateRanks(students) {
    // Sort descending by GPA
    const sorted = [...students].sort((a, b) => b.gpa - a.gpa);
    let currentRank = 1;
    return sorted.map((student, idx) => {
      if (idx > 0 && student.gpa < sorted[idx - 1].gpa) {
        currentRank = idx + 1;
      }
      return { ...student, rank: currentRank };
    });
  }

  await t.test('scoreToGrade converts Thai 8-level grading scale accurately', () => {
    assert.strictEqual(scoreToGrade(100), 4);
    assert.strictEqual(scoreToGrade(80), 4);
    assert.strictEqual(scoreToGrade(79), 3.5);
    assert.strictEqual(scoreToGrade(75), 3.5);
    assert.strictEqual(scoreToGrade(74), 3);
    assert.strictEqual(scoreToGrade(70), 3);
    assert.strictEqual(scoreToGrade(65), 2.5);
    assert.strictEqual(scoreToGrade(60), 2);
    assert.strictEqual(scoreToGrade(55), 1.5);
    assert.strictEqual(scoreToGrade(50), 1);
    assert.strictEqual(scoreToGrade(49), 0);
  });

  await t.test('calculateGPA calculates credit-weighted average accurately', () => {
    const subjects = [
      { name: 'ไทย', credits: 1.5, grade: 4 },     // 6.0
      { name: 'คณิต', credits: 1.5, grade: 3 },    // 4.5
      { name: 'วิทย์', credits: 1.0, grade: 3.5 }  // 3.5
      // Total points: 14.0 / Total credits: 4.0 = 3.50
    ];
    const gpa = calculateGPA(subjects);
    assert.strictEqual(gpa, 3.5);
  });

  await t.test('calculateRanks assigns tied ranks correctly', () => {
    const list = [
      { id: '1', name: 'ก', gpa: 3.8 },
      { id: '2', name: 'ข', gpa: 3.5 },
      { id: '3', name: 'ค', gpa: 3.8 },
      { id: '4', name: 'ง', gpa: 3.2 }
    ];
    const ranked = calculateRanks(list);
    assert.strictEqual(ranked.find(s => s.id === '1').rank, 1);
    assert.strictEqual(ranked.find(s => s.id === '3').rank, 1);
    assert.strictEqual(ranked.find(s => s.id === '2').rank, 3);
    assert.strictEqual(ranked.find(s => s.id === '4').rank, 4);
  });
});

// -------------------------------------------------------------
// Test Suite 4: Timetable Conflict Detection & Substitute Finding
// -------------------------------------------------------------
test('Suite 4: Timetable & Substitute Teacher Coordination', async (t) => {
  function findTimetableConflicts(schedule) {
    const conflicts = [];
    const map = new Map();
    for (const item of schedule) {
      const key = `${item.day}-${item.period}-${item.teacher}`;
      if (map.has(key)) {
        conflicts.push({
          teacher: item.teacher,
          day: item.day,
          period: item.period,
          firstClass: map.get(key).classId,
          secondClass: item.classId
        });
      } else {
        map.set(key, item);
      }
    }
    return conflicts;
  }

  function getAvailableSubstituteTeachers(allTeachers, schedule, day, period) {
    const busyTeachers = new Set(
      schedule
        .filter(s => s.day === day && s.period === period)
        .map(s => s.teacher)
    );
    return allTeachers.filter(t => !busyTeachers.has(t.name) && !t.onLeave);
  }

  await t.test('findTimetableConflicts detects teacher double booking on same period', () => {
    const testSchedule = [
      { day: 'จันทร์', period: 1, teacher: 'ครูสมชาย', classId: 'p1' },
      { day: 'จันทร์', period: 1, teacher: 'ครูสมชาย', classId: 'p2' },
      { day: 'จันทร์', period: 2, teacher: 'ครูสมหญิง', classId: 'p1' }
    ];
    const conflicts = findTimetableConflicts(testSchedule);
    assert.strictEqual(conflicts.length, 1);
    assert.strictEqual(conflicts[0].teacher, 'ครูสมชาย');
    assert.strictEqual(conflicts[0].period, 1);
  });

  await t.test('getAvailableSubstituteTeachers filters out busy and on-leave teachers', () => {
    const teachers = [
      { name: 'ครูเอ', onLeave: false },
      { name: 'ครูบี', onLeave: false },
      { name: 'ครูซี', onLeave: true },
      { name: 'ครูดี', onLeave: false }
    ];
    const schedule = [
      { day: 'อังคาร', period: 3, teacher: 'ครูเอ', classId: 'p3' }
    ];
    const available = getAvailableSubstituteTeachers(teachers, schedule, 'อังคาร', 3);
    const names = available.map(t => t.name);
    assert.ok(names.includes('ครูบี'));
    assert.ok(names.includes('ครูดี'));
    assert.ok(!names.includes('ครูเอ'), 'Busy teacher should not be available');
    assert.ok(!names.includes('ครูซี'), 'Teacher on leave should not be available');
  });
});

// -------------------------------------------------------------
// Test Suite 5: Attendance Rate & Weighted Aggregation
// -------------------------------------------------------------
test('Suite 5: Attendance Statistics & Aggregation', async (t) => {
  function computeWeightedAttendance(classRecords) {
    let sumPresent = 0;
    let sumChecked = 0;
    for (const rec of classRecords) {
      sumPresent += rec.presentCount;
      sumChecked += rec.totalChecked;
    }
    return sumChecked > 0 ? parseFloat(((sumPresent / sumChecked) * 100).toFixed(1)) : 0;
  }

  await t.test('computes true weighted attendance rate instead of simple unweighted average', () => {
    // Class A has 10 students, 10 present (100%)
    // Class B has 90 students, 45 present (50%)
    // Simple average would be (100 + 50) / 2 = 75% (WRONG)
    // True weighted average = (10 + 45) / (10 + 90) = 55 / 100 = 55.0% (CORRECT)
    const records = [
      { classId: 'p1', presentCount: 10, totalChecked: 10 },
      { classId: 'p2', presentCount: 45, totalChecked: 90 }
    ];
    const rate = computeWeightedAttendance(records);
    assert.strictEqual(rate, 55.0);
  });
});

// -------------------------------------------------------------
// Test Suite 6: Linking records to students
// -------------------------------------------------------------
test('Suite 6: Student record matching', async (t) => {
  const { sameStudent, normalizeThaiName } = await import('../src/utils/studentKey.ts');
  const s = { id: 'student_3206', code: '3206', name: 'เด็กชายสมชาย ใจดี' };

  await t.test('roster id wins when the record has one', () => {
    assert.equal(sameStudent({ studentId: 'student_3206', studentName: 'คนอื่น' }, s), true);
    assert.equal(sameStudent({ studentId: 'student_9999', studentCode: '3206' }, s), false);
  });

  await t.test('older records fall back to code, then to name with prefix changes', () => {
    assert.equal(sameStudent({ studentCode: '3206' }, s), true);
    assert.equal(sameStudent({ studentCode: 'student_3206' }, s), true);
    assert.equal(sameStudent({ studentName: 'นายสมชาย  ใจดี' }, s), true);
    assert.equal(sameStudent({ studentName: 'เด็กชายสมชาย ใจร้าย' }, s), false);
    assert.equal(normalizeThaiName('ด.ญ. สมหญิง  รักเรียน'), 'สมหญิงรักเรียน');
  });
});

// -------------------------------------------------------------
// Test Suite 7: Concurrent score entry must not lose another teacher's work
// -------------------------------------------------------------
test('Suite 7: Score saves are per cell, not whole-school overwrites', async (t) => {
  const { scoreWrite, applyScoreOverrides, mergeWrite } = await import('../src/utils/academicScores.ts');
  const base = [
    { classId: 'm1', subjects: [{ code: 'ว21103', hours: 40 }], students: [{ code: '2536', name: 'ก', scores: {} }] },
    { classId: 'm2', subjects: [{ code: 'ว22103', hours: 40 }], students: [{ code: '2403', name: 'ข', scores: {} }] },
  ];
  const score = (cw, fin) => ({ coursework: cw, finalExam: fin, total: cw + fin, grade: '4', attendedHours: 40, traitScore: 3, readThinkScore: 3 });

  await t.test('two teachers saving different classes at the same time both keep their scores', () => {
    let server = {};
    // both teachers start from the same (empty) server copy, then each saves one cell
    const fromA = scoreWrite('m1', '2536', 'ว21103', score(60, 25));
    const fromB = scoreWrite('m2', '2403', 'ว22103', score(55, 20));
    server = mergeWrite(server, fromA);
    server = mergeWrite(server, fromB);
    const view = applyScoreOverrides(base, server);
    assert.equal(view[0].students[0].scores['ว21103'].total, 85);
    assert.equal(view[1].students[0].scores['ว22103'].total, 75);
  });

  await t.test('a save only contains the edited cell', () => {
    const w = scoreWrite('m1', '2536', 'ว21103', score(60, 25));
    assert.deepEqual(Object.keys(w.scores), ['m1']);
    assert.deepEqual(Object.keys(w.scores.m1), ['2536']);
    assert.deepEqual(Object.keys(w.scores.m1['2536']), ['ว21103']);
  });

  await t.test('scores for a student who is not in the bundled list are kept, not dropped', () => {
    const view = applyScoreOverrides(base, mergeWrite({}, scoreWrite('m1', '9999', 'ว21103', score(50, 10))), {
      m1: [{ code: '9999', name: 'นักเรียนย้ายเข้า' }],
    });
    const added = view[0].students.find(s => s.code === '9999');
    assert.ok(added, 'roster student added to the class');
    assert.equal(added.scores['ว21103'].total, 60);
  });

  await t.test('a student with no score has no grade, not a made-up pass', () => {
    const view = applyScoreOverrides(base, {}, { m1: [{ code: '9999', name: 'นักเรียนย้ายเข้า' }] });
    const added = view[0].students.find(s => s.code === '9999');
    assert.deepEqual(added.scores, {});
  });
});

// -------------------------------------------------------------
// Test Suite 8: Global styles load for every (lazy-loaded) page
// -------------------------------------------------------------
test('Suite 8: Site-wide CSS is imported once, at the entry, in cascade order', () => {
  const main = fs.readFileSync(path.join(rootDir, 'src', 'main.tsx'), 'utf-8');
  const order = ["'./index.css'", "'./App.css'", "'bootstrap/dist/css/bootstrap.min.css'"].map(s => main.indexOf(s));
  assert.ok(order.every(i => i >= 0), 'main.tsx imports index.css, App.css and Bootstrap');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'index.css, then App.css, then Bootstrap');

  // a CSS import inside a lazy page only loads when that page is opened (e.g. Bootstrap only on /admin)
  const pagesDir = path.join(rootDir, 'src', 'pages');
  const offenders = fs.readdirSync(pagesDir).filter(f => /import\s+['"][^'"]+\.css['"]/.test(fs.readFileSync(path.join(pagesDir, f), 'utf-8')));
  assert.deepEqual(offenders, [], `pages importing CSS: ${offenders.join(', ')}`);
});

// -------------------------------------------------------------
// Test Suite 9: Term start dates match the school calendar
// -------------------------------------------------------------
test('Suite 9: Each term opens on a school day', async () => {
  const { DEFAULT_ACTIVITIES } = await import('../src/data/defaultActivities.ts');
  const openings = DEFAULT_ACTIVITIES.filter(a => a.id.startsWith('d-open-'));
  assert.ok(openings.length >= 2, 'both term openings are listed');
  for (const a of openings) {
    const weekday = new Date(`${a.date}T00:00:00`).getDay();
    assert.ok(weekday >= 1 && weekday <= 5, `${a.title} (${a.date}) falls on a weekend`);
  }
  // ปฏิทินโรงเรียน 2569: 2 พ.ย. 2569 = เปิดเทอมภาคเรียนที่ 2 วันเรียนที่ 1
  assert.equal(openings.find(a => a.id === 'd-open-2-69')?.date, '2026-11-02');
});

// -------------------------------------------------------------
// Test Suite 10: Facebook posts become website news without duplicates
// -------------------------------------------------------------
test('Suite 10: Facebook Page sync maps posts and skips ones already on the site', async () => {
  const { toSitePost, newSitePosts, postKeys, thaiDate, titleFromMessage } = await import('./lib/facebookPosts.mjs');

  // 23:30 UTC is already the next day in Thailand
  assert.equal(thaiDate('2026-11-01T23:30:00+0000'), '2026-11-02');
  assert.equal(titleFromMessage('\n  เปิดภาคเรียนที่ 2/2569  \nรายละเอียด'), 'เปิดภาคเรียนที่ 2/2569');
  assert.ok(titleFromMessage('ก '.repeat(200)).endsWith('…'));
  assert.equal(toSitePost({ id: '1_2', message: '   ', created_time: '2026-11-02T01:00:00+0000' }), null, 'posts without text are skipped');

  // a numeric page id before /posts/ is not a post id
  assert.deepEqual(postKeys('https://www.facebook.com/100064/posts/987654321/'), ['987654321']);
  assert.deepEqual(postKeys('https://www.facebook.com/BnKhlngMddang/posts/pfbid0abcXYZ'), ['pfbid0abcXYZ']);

  const fb = [
    { id: '100064_111111111', message: 'ประชุมผู้ปกครอง 2/2569\nรายละเอียด', created_time: '2026-11-03T02:00:00+0000', permalink_url: 'https://www.facebook.com/100064/posts/pfbidAAA' },
    { id: '100064_222222222', message: 'ตลาดนัดทักษะอาชีพ ประจำภาคเรียน', created_time: '2026-11-06T02:00:00+0000', permalink_url: 'https://www.facebook.com/100064/posts/pfbidBBB' },
    { id: '100064_333333333', message: 'เปิดเทอมภาคเรียนที่ 2/2569 วันเรียนที่ 1', created_time: '2026-11-02T01:00:00+0000', permalink_url: 'https://www.facebook.com/100064/posts/pfbidCCC' },
    { id: '100064_444444444', message: 'กีฬาสีภายใน', created_time: '2026-11-10T01:00:00+0000', permalink_url: 'https://www.facebook.com/100064/posts/pfbidDDD' },
  ];
  const existing = [
    { id: 'fb_100064_111111111', title: 'ประชุมผู้ปกครอง 2/2569', date: '2026-11-03', facebookUrl: 'https://www.facebook.com/100064/posts/pfbidAAA' }, // synced before
    { id: 'manual1', title: 'ตลาดนัดทักษะอาชีพ', date: '2026-11-06', facebookUrl: 'https://www.facebook.com/share/p/xyz/' }, // typed by a teacher, other link
    { id: 'manual2', title: 'x', date: '2026-01-01', facebookUrl: 'https://www.facebook.com/BnKhlngMddang/posts/333333333' }, // same numeric id
  ];
  const added = newSitePosts(fb, existing);
  assert.deepEqual(added.map(p => p.docId), ['fb_100064_444444444']);
  assert.equal(added[0].data.date, '2026-11-10');
  assert.equal(added[0].data.source, 'facebook');
});

test('Suite 11: Facebook sync writes only new posts and never overwrites news', async () => {
  const { syncFacebookPosts } = await import('./lib/facebookPosts.mjs');
  const docs = new Map([
    ['teacher1', { title: 'ข่าวที่ครูลงเอง', date: '2026-10-01', facebookUrl: '' }],
    ['fb_9_100000001', { title: 'โพสต์เก่า', date: '2026-10-20', source: 'facebook', imageUrl: 'https://old.jpg' }],
  ]);
  const calls = [];
  const db = {
    collection: () => ({
      get: async () => ({ docs: [...docs].map(([id, data]) => ({ id, data: () => data })) }),
      doc: id => ({
        create: async data => { if (docs.has(id)) throw new Error('exists'); calls.push(['create', id]); docs.set(id, data); },
        update: async data => { calls.push(['update', id, Object.keys(data).sort().join()]); },
      }),
    }),
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ data: [
      { id: '9_100000001', message: 'โพสต์เก่า', created_time: '2026-10-20T01:00:00+0000', permalink_url: 'https://www.facebook.com/9/posts/100000001', full_picture: 'https://new.jpg' },
      { id: '9_100000002', message: 'ข่าวใหม่จากเพจ', created_time: '2026-11-02T01:00:00+0000', permalink_url: 'https://www.facebook.com/9/posts/100000002', full_picture: 'https://p2.jpg' },
    ] }),
  });

  const preview = await syncFacebookPosts({ db, pageId: '9', token: 't', fetchImpl });
  assert.equal(calls.length, 0, 'dry run writes nothing');
  assert.deepEqual(preview.added.map(p => p.id), ['fb_9_100000002']);
  assert.equal(preview.imagesRefreshed, 1);

  await syncFacebookPosts({ db, pageId: '9', token: 't', fetchImpl, write: true });
  assert.deepEqual(calls, [['create', 'fb_9_100000002'], ['update', 'fb_9_100000001', 'imageUrl,syncedAt']]);
  assert.equal(docs.get('teacher1').title, 'ข่าวที่ครูลงเอง', "a teacher's news is untouched");
});

// -------------------------------------------------------------
// Test Suite 12: ประถม and มัธยม are scored differently (แบบ ปพ.5 ของโรงเรียน)
// -------------------------------------------------------------
test('Suite 12: ประถม grades the year (50 + 50), มัธยม grades each semester (100)', async () => {
  const { scoreScheme, scoreFromParts, scorePercents, INITIAL_ACADEMIC_DATA } = await import('../src/data/academicData.ts');

  assert.deepEqual(scoreScheme('ประถม'), { courseworkMax: 35, finalMax: 15, yearly: true, weightLabel: 'น้ำหนัก' });
  assert.deepEqual(scoreScheme('มัธยม'), { courseworkMax: 70, finalMax: 30, yearly: false, weightLabel: 'หน่วยกิต' });

  // มัธยม: one semester out of 100
  assert.deepEqual(scoreFromParts('มัธยม', { coursework: 60, finalExam: 22 }), { total: 82, grade: '4' });
  // ประถม term 1 only: total out of 50 shown, no grade yet
  assert.deepEqual(scoreFromParts('ประถม', { coursework: 30, finalExam: 12 }), { total: 42, grade: '' });
  // ประถม both terms: year total out of 100 graded
  assert.deepEqual(scoreFromParts('ประถม', { coursework: 30, finalExam: 12, term2Coursework: 28, term2FinalExam: 10 }), { total: 80, grade: '4' });
  // ร / มส apply even before term 2
  assert.equal(scoreFromParts('ประถม', { coursework: 30, finalExam: 12 }, 'มส').grade, 'มส');

  assert.deepEqual(scorePercents('ประถม', { coursework: 35, finalExam: 7.5 }), { courseworkPct: 100, finalPct: 50 });
  assert.deepEqual(scorePercents('มัธยม', { coursework: 35, finalExam: 15 }), { courseworkPct: 50, finalPct: 50 });

  // built-in ประถม term-1 data fits the 35/15 scale and waits for term 2
  for (const cls of INITIAL_ACADEMIC_DATA.filter(c => c.level === 'ประถม')) {
    for (const st of cls.students) for (const sc of Object.values(st.scores)) {
      assert.ok(sc.coursework <= 35 && sc.finalExam <= 15, `${cls.classId} ${st.code} over the ประถม term maximum`);
      assert.ok(sc.grade === '' || sc.grade === 'ร' || sc.grade === 'มส', `${cls.classId} ${st.code} graded before term 2`);
    }
  }
});

// -------------------------------------------------------------
// Test Suite 13: SGS rules (full marks per indicator, remedial, item levels, activities)
// -------------------------------------------------------------
test('Suite 13: SGS-style assessment rules', async () => {
  const a = await import('../src/utils/assessment.ts');
  const { scoreScheme, calculateStudentGPA, effectiveGrade } = await import('../src/data/academicData.ts');
  const sec = scoreScheme('มัธยม');
  const pri = scoreScheme('ประถม');

  // indicators + midterm must equal the level's coursework share
  const plan = { before: [10, 10, 10], midterm: 20, after: [10, 10], final: 30 };
  assert.deepEqual(a.planErrors(plan, sec), []);
  assert.ok(a.planErrors({ ...plan, midterm: 10 }, sec).some(e => e.includes('ต้องเท่ากับ 70')));
  assert.ok(a.planErrors({ before: [10, 10, 15], midterm: 0, after: [], final: 15 }, pri).length === 0);
  assert.ok(a.planErrors({ ...plan, before: Array(10).fill(1) }, sec).some(e => e.includes('ไม่เกิน 9')));

  // marks never exceed their full mark; coursework is their sum
  const d = a.fitDetail({ before: [12, 7, null], midterm: 25, after: [5] }, plan);
  assert.deepEqual(d, { before: [10, 7, null], midterm: 20, after: [5, null] });
  assert.equal(a.courseworkFromDetail(d), 42);
  assert.equal(a.detailHasMarks(a.fitDetail(undefined, plan)), false);

  // remedial caps: 0 and มส up to 1, ร and เรียนซ้ำ 0-4; the remedial grade counts in GPA
  assert.deepEqual(a.remedialGradeOptions('0', 'แก้ตัว'), ['0', '1']);
  assert.deepEqual(a.remedialGradeOptions('มส', 'แก้ตัว'), ['0', '1']);
  assert.equal(a.remedialGradeOptions('ร', 'แก้ตัว').at(-1), '4');
  assert.equal(a.remedialGradeOptions('0', 'เรียนซ้ำ').at(-1), '4');
  assert.equal(effectiveGrade({ grade: '0', remedial: { grade: '1', type: 'แก้ตัว', date: '2026-11-02', by: 'ครู' } }), '1');
  const subjects = [{ code: 'X', name: 'x', type: 'พื้นฐาน', group: '', credits: 1, hours: 40, teacher: '' }];
  const student = { scores: { X: { grade: '0', remedial: { grade: '1', type: 'แก้ตัว', date: '', by: '' } } } };
  assert.equal(calculateStudentGPA(student, subjects).gpa, 1);

  // item levels: rounded mean of the items entered
  assert.equal(a.itemsLevel([3, 3, 2, 2, 3, 3, 3, 3]), 3);
  assert.equal(a.itemsLevel([1, 2, null]), 2);
  assert.equal(a.itemsLevel([null, null]), null);

  // activities: ผ่าน only when all are ผ, ไม่ผ่าน as soon as one is มผ
  assert.equal(a.activityOverall({ A: 'ผ', B: 'ผ' }, ['A', 'B']), 'ผ่าน');
  assert.equal(a.activityOverall({ A: 'ผ', B: 'มผ' }, ['A', 'B']), 'ไม่ผ่าน');
  assert.equal(a.activityOverall({ A: 'ผ' }, ['A', 'B']), null);
});
