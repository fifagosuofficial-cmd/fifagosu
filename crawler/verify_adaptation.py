"""PlayerPreView의 적응도 1~5(n1Grow=0~4) 응답을 비교해 규칙을 검증해요.

데이터센터 화면(datacenter.js)은 적응도를 n1Grow 값(0=+1 … 4=+5)으로 보내요.
2026-11-21 실측: 단계마다 34개 세부 능력치·요약·포지션 OVR이 모두 +1.
"""
from __future__ import annotations

import json
from pathlib import Path

from fgcrawl import parse_preview


def _samples(data):
    detail_dir = Path(data) / "detail"
    out = []
    for path in sorted(detail_dir.glob("*.json")):
        try:
            shard = json.loads(path.read_text("utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for key, row in shard.items():
            if len(row.get("stats") or {}) >= 30 and row.get("pos"):
                out.append((int(key), row))
    return sorted(out, key=lambda x: (-int(x[1].get("ovr") or 0), x[0]))


def _flat(record):
    flat = {f"stats.{k}": v for k, v in (record.get("stats") or {}).items() if isinstance(v, int)}
    flat.update({f"summary.{k}": v for k, v in (record.get("summary") or []) if isinstance(v, int)})
    flat.update({f"pos.{k}": v for k, v in (record.get("pos") or []) if isinstance(v, int)})
    return flat


def verify(client, data):
    samples = _samples(data)
    if not samples:
        return {"adaptation_probe": "skip", "adaptation_probe_reason": "no_detail_card"}
    spid = samples[0][0]
    rows = {}
    for level in range(1, 6):
        html = client.post("/datacenter/PlayerPreView", {
            "spid": spid, "n1strong": 1, "n1Grow": level - 1, "n1TeamColor": 0,
        })
        parsed = parse_preview(html, spid, adaptation=level)
        if not parsed:
            raise ValueError(f"적응도 {level} 응답에 능력치가 없어요")
        rows[level] = _flat(parsed)
    common = set.intersection(*(set(x) for x in rows.values()))
    # PlayerPreView 수준별 차이를 모든 공통 스탯에서 확인합니다.
    deltas = {str(level): sorted({rows[level][k] - rows[1][k] for k in common})
              for level in range(1, 6)}
    expected = {str(level): [level - 1] for level in range(1, 6)}
    confirmed = len(common) >= 34 and deltas == expected
    result = {
        "source": "https://fconline.nexon.com/datacenter/PlayerPreView",
        "parameter": "n1Grow", "sampleSpid": spid,
        "fieldsCompared": len(common), "deltasFromLevel1": deltas,
        "confirmedPlusOnePerLevel": confirmed,
        "basis": "적응도 1단계 기준", "at": __import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"),
    }
    out = Path(data) / "rules" / "adaptation_verification.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), "utf-8")
    if confirmed:
        rule = {"source": result["source"], "verified": True, "sampleSpid": spid,
                "baseLevel": 1, "bonusFromBase": [None, 0, 1, 2, 3, 4],
                "applies_to": ["stats", "summary", "pos_ovr"], "at": result["at"]}
        (Path(data) / "rules" / "adaptation_bonus.json").write_text(
            json.dumps(rule, ensure_ascii=False, separators=(",", ":")), "utf-8")
    result["adaptation_probe"] = "confirmed" if confirmed else "mismatch"
    return {"adaptation_probe": result["adaptation_probe"], "adaptation_fields": len(common),
            "adaptation_sample": spid}
