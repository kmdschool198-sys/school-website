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
