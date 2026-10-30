"""Read filled ปพ.5 workbooks into private/porpor5_scores_<term>.json.

The "สรุปคะแนน" sheet holds indicator scores, midterm and final per row; totals and grades are
formulas without cached values, so they are recomputed here the same way the workbook does:
coursework = indicators + midterm (out of 70), final out of 30, total out of 100.
Student code/name come from "ข้อมูลเกี่ยวกับนักเรียน" in the same row order.

Usage: python scripts/parse_porpor5.py "<folder with ปพ.5_*.xlsx>" 1-2569
Output: {"<subject code>": {"level": "ม.1", "name": ..., "file": ..., "students": [{no, code, name,
         coursework, midterm, finalExam, total}]}}
"""
import glob
import json
import os
import re
import sys
import warnings

import openpyxl

warnings.filterwarnings("ignore")
sys.stdout.reconfigure(encoding="utf-8")

folder, term = sys.argv[1], sys.argv[2]
num = lambda v: float(v) if isinstance(v, (int, float)) else None
out = {}
for path in sorted(glob.glob(os.path.join(folder, "**", "ปพ.5_*.xlsx"), recursive=True)):
    base = os.path.basename(path)
    if "backup" in base or base.startswith("~$"):
        continue
    m = re.match(r"ปพ\.5_(ม\.\d|ป\.\d)_([^_]+)_(.+)\.xlsx$", base)
    if not m:
        print("skip (name)", base)
        continue
    level, code, subj = m.groups()
    wb = openpyxl.load_workbook(path, data_only=True)

    # roster sheet: first row with a 4-digit student code starts the list
    info = [[c for c in r] for r in wb["ข้อมูลเกี่ยวกับนักเรียน"].iter_rows(values_only=True)]
    roster = []
    for r in info:
        cells = [str(v).strip() for v in r if v not in (None, "")]
        code_cell = next((c for c in cells if re.fullmatch(r"\d{4}", c)), None)
        name_cell = next((c for c in cells if re.search(r"[฀-๿]{2,}", c) and not re.fullmatch(r"\d+", c)), None)
        if code_cell and name_cell:
            roster.append((code_cell, " ".join(name_cell.split())))

    ws = wb["สรุปคะแนน"]
    rows = list(ws.iter_rows(values_only=True))
    hdr = next(i for i, r in enumerate(rows) if r and any(str(v or "").strip() == "เลขประจำตัว" for v in r))
    names = [str(v or "").strip() for v in rows[hdr]]
    col_mid = next(i for i, n in enumerate(names) if n.startswith("คะแนนกลางภาค"))
    col_fin = next(i for i, n in enumerate(names) if n.startswith("คะแนนปลายภาค"))
    col_sum = next(i for i, n in enumerate(names) if n.startswith("รวมตัวชี้วัด"))
    students = []
    for r in rows[hdr + 3:]:
        if not isinstance(r[0], (int, float)):
            continue
        no = int(r[0])
        ind = [num(v) for v in r[3:col_sum]]
        ind = [v for v in ind if v is not None]
        mid, fin = num(r[col_mid]), num(r[col_fin])
        if not ind and mid is None and fin is None:
            continue  # empty row in the template
        if no > len(roster):
            print(f"  {base}: row {no} has scores but no student in the roster sheet")
            continue
        coursework = sum(ind) + (mid or 0)
        students.append({"no": no, "code": roster[no - 1][0], "name": roster[no - 1][1],
                         "coursework": coursework, "midterm": mid, "finalExam": fin or 0,
                         "total": coursework + (fin or 0)})
    key = code
    if key in out:  # a second file for the same subject code (e.g. a different section)
        key = f"{code}#{subj}"
    out[key] = {"level": level, "code": code, "name": subj.replace("_", " "), "file": base, "students": students}
    print(f"{base}: {len(roster)} in roster, {len(students)} scored")

dest = os.path.join(os.path.dirname(__file__), "..", "private", f"porpor5_scores_{term}.json")
json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("->", os.path.abspath(dest))
