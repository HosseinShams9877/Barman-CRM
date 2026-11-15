#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""تجمیع پوشش آزمون به ازای هر مسیر از coverage-summary.json."""
import json
import os
import sys

summary_path = "coverage/coverage-summary.json"
with open(summary_path, encoding="utf-8") as fh:
    data = json.load(fh)

rows = []
for key, val in data.items():
    if key == "total":
        continue
    norm = key.replace("\\", "/")
    # کلیدها مطلق‌اند (مثل D:/New folder/CRM-Barman/src/...) — پیشوند ریشه حذف
    idx = norm.find("/src/")
    rows.append((norm[idx + 1:] if idx >= 0 else norm, val))

buckets = {
    "src/core": [],
    "src/modules/production": [],
    "src/modules/inventory": [],
    "src/modules/orders": [],
    "src/modules/settings": [],
    "src/modules/customers": [],
    "src/app": [],
    "other": [],
}

for norm, val in rows:
    placed = False
    for name in buckets:
        if name != "other" and norm.startswith(name + "/"):
            buckets[name].append((norm, val))
            placed = True
            break
    if not placed:
        if norm.startswith("src/"):
            buckets["other"].append((norm, val))
        else:
            buckets["src/app"].append((norm, val))


def agg(entries):
    if not entries:
        return None
    stmts = sum(e[1]["statements"]["total"] for e in entries)
    stmts_hit = sum(e[1]["statements"]["covered"] for e in entries)
    branch = sum(e[1]["branches"]["total"] for e in entries)
    branch_hit = sum(e[1]["branches"]["covered"] for e in entries)
    funcs = sum(e[1]["functions"]["total"] for e in entries)
    funcs_hit = sum(e[1]["functions"]["covered"] for e in entries)
    lines = sum(e[1]["lines"]["total"] for e in entries)
    lines_hit = sum(e[1]["lines"]["covered"] for e in entries)
    return {
        "files": len(entries),
        "statements": (stmts_hit / stmts * 100) if stmts else 0.0,
        "branches": (branch_hit / branch * 100) if branch else 0.0,
        "functions": (funcs_hit / funcs * 100) if funcs else 0.0,
        "lines": (lines_hit / lines * 100) if lines else 0.0,
    }


for name in buckets:
    result = agg(buckets[name])
    if result is None:
        print(f"{name}: no files")
        continue
    print(
        f"{name}: files={result['files']} "
        f"stmts={result['statements']:.1f}% branches={result['branches']:.1f}% "
        f"funcs={result['functions']:.1f}% lines={result['lines']:.1f}%"
    )

print()
print("total:", json.dumps(data["total"], ensure_ascii=False))
print()
print("all keys:")
for norm, _ in sorted(rows):
    print(" ", norm)
