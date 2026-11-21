#!/usr/bin/env python3
"""
강화 능력치 검증 (D1-0) — 데이터센터에서 같은 카드를 강화 단계만 바꿔 받아,
34개 세부 능력치·포지션 OVR이 '1강 + 규칙표 값'과 같은지 비교해요.

  python crawler/verify_grade.py                       # 기본 3장 × 1·5·8·11·13강 (15회)
  python crawler/verify_grade.py --spid 854239085 --grades 1-13
  python crawler/verify_grade.py --random 1 --grades 1,13   # 강화 감시용(무작위 1장)

불일치가 있으면 종료 코드 1. 요청 간격은 3초 이상.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fgcrawl  # noqa: E402

RULES = Path(__file__).resolve().parent / "rules" / "grade_bonus.json"
DEFAULT = [854239085, 100168473, 100238380]   # 홀란(ST), 베켄바워(CB), 야신(GK)


def grades_arg(s):
    if "-" in s:
        a, b = s.split("-")
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in s.split(",")]


def fetch(client, spid, g):
    html = client.post("/datacenter/PlayerPreView", {
        "spid": spid, "n1strong": g, "n1Grow": 0, "n1Adaptation": 5, "n1TeamColor": 0,
    })
    return fgcrawl.parse_preview(html, spid, adaptation=5)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--spid", type=int, nargs="*")
    ap.add_argument("--random", type=int, default=0, help="data/detail에서 무작위 N장")
    ap.add_argument("--grades", default="1,5,8,11,13")
    a = ap.parse_args(argv)
    bonus = json.loads(RULES.read_text(encoding="utf-8"))["bonus"]
    grades = grades_arg(a.grades)
    if 1 not in grades:
        grades = [1] + grades
    spids = a.spid or []
    if a.random:
        pool = list(fgcrawl.Store().all("detail").keys())
        spids += [int(x) for x in random.sample(pool, min(a.random, len(pool)))]
    spids = spids or DEFAULT
    client = fgcrawl.Client(delay=3.0)
    bad = 0
    for spid in spids:
        got = {g: fetch(client, spid, g) for g in grades}
        base = got[1]
        if not base:
            print(spid, "1강 응답 파싱 실패"); bad += 1; continue
        for g in grades[1:]:
            rec, want = got[g], bonus[g]
            if not rec:
                print(spid, g, "파싱 실패"); bad += 1; continue
            diffs = {k: rec["stats"][k] - base["stats"][k] for k in base["stats"]
                     if rec["stats"].get(k) is not None and base["stats"].get(k) is not None}
            wrong = {k: d for k, d in diffs.items() if d != want}
            od = (rec["ovr"] or 0) - (base["ovr"] or 0)
            ok = not wrong and od == want
            bad += 0 if ok else 1
            print(f"{spid} {base['name']} {g}강: 기대 +{want}, OVR +{od}, 능력치 {'일치' if not wrong else wrong}")
    print("불일치", bad, "건 / 요청", client.count, "회")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
