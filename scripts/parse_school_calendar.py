"""Read the school's academic calendar workbook into private/school_calendar_2569.json.

Each month sheet is a Sunday-first grid: a row of day cells ("วันเรียนที่ 5   12" marks a
teaching day, a bare number is a non-teaching day) followed by a row of notes for those days.
Output: {"YYYY-MM-DD": {"teaching": bool, "teachingDay": int|None, "note": str}}

Usage: python scripts/parse_school_calendar.py "<path to ปฏิทิน...xlsx>"
"""
import json
import os
import re
import sys
import warnings

import openpyxl

warnings.filterwarnings("ignore")
sys.stdout.reconfigure(encoding="utf-8")

MONTHS = {"มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4, "พฤษภาคม": 5, "มิถุนายน": 6,
          "กรกฎาคม": 7, "กรกฏาคม": 7, "สิงหาคม": 8, "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12}

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
out = {}
for ws in wb.worksheets:
    name = re.sub(r"\d+", "", ws.title).strip()
    month = MONTHS[name]
    year = 2027 if month <= 3 else 2026  # ปีการศึกษา 2569 = พ.ค. 2026 - มี.ค. 2027
    rows = [[c.value for c in r] for r in ws.iter_rows()]
    # header row with day names gives the 7 columns (Sun..Sat)
    hdr = next(i for i, r in enumerate(rows) if any(str(v or "").strip() == "อาทิตย์" for v in r))
    cols = [j for j, v in enumerate(rows[hdr]) if str(v or "").strip() in
            ("อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์")]
    i = hdr + 1
    while i < len(rows):
        day_cells = [rows[i][c] if c < len(rows[i]) else None for c in cols]
        days = []
        for v in day_cells:
            m = re.search(r"(\d{1,2})\s*$", str(v or "").strip())
            days.append(int(m.group(1)) if m else None)
        if not any(days):
            i += 1
            continue
        notes = [rows[i + 1][c] if i + 1 < len(rows) and c < len(rows[i + 1]) else None for c in cols]
        for k, v in enumerate(day_cells):
            if not days[k]:
                continue
            text = str(v or "")
            td = re.search(r"วันเรียนที่\s*(\d+)", text)
            date = f"{year}-{month:02d}-{days[k]:02d}"
            note = " ".join(str(notes[k] or "").split())
            out[date] = {"teaching": bool(td), "teachingDay": int(td.group(1)) if td else None, "note": note}
        i += 2

dest = os.path.join(os.path.dirname(__file__), "..", "private", "school_calendar_2569.json")
json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(out), "days ->", os.path.abspath(dest))
