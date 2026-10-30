"""Write the scores read from the teachers' ปพ.5 files (private/porpor5_scores_<term>.json) into
src/data/academicData.ts, matching students by เลขประจำตัว (never by row position).
Only coursework / finalExam / total / grade of the imported subjects change; hours, trait and
read-think scores stay as they are. Prints every change.

Usage: python scripts/apply_porpor5_scores.py 1-2569 [--write]
"""
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
term = sys.argv[1]
write = "--write" in sys.argv
root = os.path.join(os.path.dirname(__file__), "..")
ts_path = os.path.join(root, "src", "data", "academicData.ts")
scores = json.load(open(os.path.join(root, "private", f"porpor5_scores_{term}.json"), encoding="utf-8"))


def grade(total):
    for cut, g in ((80, "4"), (75, "3.5"), (70, "3"), (65, "2.5"), (60, "2"), (55, "1.5"), (50, "1")):
        if total >= cut:
            return g
    return "0"


src = open(ts_path, encoding="utf-8", newline="").read()
m = re.search(r"export const \w+: ClassAcademicData\[\] = ", src)
start = m.end()
end = src.index("\n];", start) + 2
classes = json.loads(src[start:end])
LEVEL = {"ม.1": "m1", "ม.2": "m2", "ม.3": "m3", "ป.1": "p1", "ป.2": "p2", "ป.3": "p3", "ป.4": "p4", "ป.5": "p5", "ป.6": "p6"}

changed = 0
for key, subj in scores.items():
    if "#" in key:
        primary = scores.get(subj["code"])
        if primary and primary["students"] == subj["students"]:
            continue  # duplicate copy of the same subject file
        print(f"!! {subj['file']} differs from the main file for {subj['code']} — not applied, check which is final")
        continue
    cls = next(c for c in classes if c["classId"] == LEVEL[subj["level"]])
    by_code = {s["code"]: s for s in cls["students"]}
    for st in subj["students"]:
        rec = by_code.get(st["code"])
        if rec is None:
            print(f"!! {subj['code']} {st['code']} {st['name']}: not in class {cls['classId']} — skipped")
            continue
        cur = rec["scores"].get(subj["code"])
        if cur is None:
            print(f"!! {subj['code']} {st['code']}: subject missing for this student — skipped")
            continue
        new = {"coursework": st["coursework"], "finalExam": st["finalExam"], "total": st["total"], "grade": grade(st["total"])}
        new = {k: (int(v) if isinstance(v, float) and v.is_integer() else v) for k, v in new.items()}
        if any(cur.get(k) != v for k, v in new.items()):
            print(f"{cls['classId']} {subj['code']} {st['code']}: "
                  f"{cur['coursework']}/{cur['finalExam']}={cur['total']} ({cur['grade']}) -> "
                  f"{new['coursework']}/{new['finalExam']}={new['total']} ({new['grade']})")
            cur.update(new)
            changed += 1

print(f"\nเปลี่ยน {changed} คะแนน")
if write and changed:
    body = json.dumps(classes, ensure_ascii=False, indent=2)
    open(ts_path, "w", encoding="utf-8", newline="").write(src[:start] + body + src[end:])
    print("เขียน", os.path.abspath(ts_path))
elif not write:
    print("Dry run (เพิ่ม --write เพื่อบันทึก)")
