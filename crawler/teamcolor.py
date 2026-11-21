"""FC온라인 공식 데이터센터 팀컬러 목록 파싱·수집."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup

URL = "https://fconline.nexon.com/datacenter/teamcolor"
SOURCE = "https://fconline.nexon.com/datacenter/teamcolor"
KST = dt.timezone(dt.timedelta(hours=9))

STAT_KEYS = {
    "속력": "sprintspeed", "가속력": "acceleration", "골 결정력": "finishing",
    "슛 파워": "shotpower", "중거리 슛": "longshots", "중거리슛": "longshots",
    "위치 선정": "positioning", "위치선정": "positioning", "발리슛": "volleys",
    "페널티 킥": "penalties", "패널티킥": "penalties", "짧은 패스": "shortpassing",
    "짧은패스": "shortpassing", "시야": "vision", "크로스": "crossing",
    "긴 패스": "longpassing", "긴패스": "longpassing", "프리킥": "freekick",
    "커브": "curve", "드리블": "dribbling", "볼 컨트롤": "ballcontrol",
    "민첩성": "agility", "밸런스": "balance", "반응 속도": "reactions",
    "반응속도": "reactions", "대인 수비": "marking", "대인수비": "marking",
    "태클": "standingtackle", "가로채기": "interceptions", "헤더": "heading",
    "슬라이딩 태클": "slidingtackle", "슬라이딩태클": "slidingtackle",
    "몸싸움": "strength", "스태미너": "stamina", "적극성": "aggression",
    "점프": "jumping", "침착성": "composure", "GK 다이빙": "gkdiving",
    "GK 핸들링": "gkhandling", "GK 킥": "gkkicking", "GK 반응속도": "gkreflexes",
    "GK 위치 선정": "gkpositioning", "GK 위치선정": "gkpositioning",
}
_STAT_ALT = "|".join(sorted(map(re.escape, STAT_KEYS), key=len, reverse=True))
_EFFECT = re.compile(rf"(전체\s*능력치|{_STAT_ALT})\s*\+\s*(\d+)")
_LEVEL = re.compile(r"(\d+)\s*단계")


def _kind(el, text):
    raw = " ".join([str(el.get("class", "")), str(el.get("data-type", "")),
                    str(el.get("data-category", "")), str(el.get("data-teamcolortype", "")), text]).lower()
    if "강화" in raw or "grade" in raw or "enhance" in raw:
        return "grade"
    if "국가" in raw or "nation" in raw:
        return "nation"
    if "클럽" in raw or "club" in raw:
        return "club"
    if "관계" in raw or "relation" in raw:
        return "relation"
    if "스페셜" in raw or "special" in raw:
        return "special"
    return "unknown"


def _effect_stats(text):
    out = {}
    for label, value in _EFFECT.findall(text):
        key = "all" if label.replace(" ", "") == "전체능력치" else STAT_KEYS.get(label)
        if key:
            out[key] = int(value)
    return out


def _row_record(el):
    text = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
    levels = _LEVEL.findall(text)
    stats = _effect_stats(text)
    if not levels or not stats or len(text) > 600:
        return None
    # Table rows preserve columns cleanly; otherwise strip the trailing stage/effect fields.
    cells = [re.sub(r"\s+", " ", c.get_text(" ", strip=True)).strip()
             for c in el.find_all(["th", "td"], recursive=False)]
    stage = int(levels[-1])
    name = ""
    if len(cells) >= 2:
        for cell in cells:
            if not _LEVEL.search(cell) and not _effect_stats(cell) and not re.fullmatch(r"\d+", cell):
                name = cell
                break
    if not name:
        prefix = _LEVEL.split(text)[0]
        name = re.sub(r"^\s*\d+\s+", "", prefix).strip(" ·|:-")
    name = re.sub(r"\s+", " ", name).strip()
    if not name or name in {"팀컬러 정보", "적용 효과", "팀컬러"}:
        return None
    # 데이터센터 표의 첫 숫자 열은 해당 팀컬러의 적용 인원 조건이에요.
    # HTML 레이아웃이 달라지면 명시적인 'N명' 표기를 우선합니다.
    m = re.search(r"(?:조건|필요|인원)?\s*(\d+)\s*명", text)
    if not m and cells:
        m = re.fullmatch(r"\s*(\d+)\s*", cells[0])
    if not m:
        m = re.match(r"^\s*(\d+)\b", text)
    attrs = " ".join(str(el.get(k, "")) for k in ("class", "data-type", "data-category", "data-teamcolortype"))
    return {
        "name": name,
        "type": _kind(el, attrs),
        "requiredCount": int(m.group(1)) if m else None,
        "maxLevel": stage,
        "effects": [{"level": stage, "requiredCount": int(m.group(1)) if m else None, "stats": stats,
                     "raw": _EFFECT.findall(text) and text[_EFFECT.search(text).start():] or ""}],
        "rawText": text,
    }


def parse_teamcolors(html: str) -> list[dict]:
    """페이지 내 팀컬러 행을 뽑고 이름·종류별 단계/효과로 묶어요."""
    soup = BeautifulSoup(html, "html.parser")
    candidates = list(soup.select("tr"))
    records = [r for el in candidates if (r := _row_record(el))]
    # Nexon can change from table rows to cards. Search compact list/card containers as fallback.
    if not records:
        candidates = soup.select("li, [class*=teamColor], [class*=teamcolor], div")
        seen = set()
        for el in candidates:
            key = id(el)
            if key in seen:
                continue
            seen.add(key)
            r = _row_record(el)
            if r:
                records.append(r)
    merged = {}
    for r in records:
        k = (r["name"], r["type"])
        item = merged.setdefault(k, {"name": r["name"], "type": r["type"],
                                     "requiredCounts": [], "maxLevel": 0,
                                     "effects": [], "rawRows": []})
        if r["requiredCount"] is not None:
            item["requiredCounts"].append(r["requiredCount"])
        item["maxLevel"] = max(item["maxLevel"], r["maxLevel"])
        item["effects"].extend(r["effects"])
        item["rawRows"].append(r["rawText"])
    out = []
    for item in merged.values():
        item["requiredCounts"] = sorted(set(item["requiredCounts"]))
        effects = {json.dumps(x, ensure_ascii=False, sort_keys=True): x for x in item["effects"]}
        item["effects"] = sorted(effects.values(), key=lambda x: (x["level"], x.get("requiredCount") or 0))
        item["rawRows"] = sorted(set(item["rawRows"]))
        out.append(item)
    return sorted(out, key=lambda x: (x["type"], x["name"]))


def collect(client, data_dir, previous=None):
    """GET 1회로 공식 페이지를 갱신. 파싱 실패/급감이면 기존 데이터를 보존."""
    html = client.get("/datacenter/teamcolor", timeout=90)
    items = parse_teamcolors(html)
    old_items = (previous or {}).get("items", [])
    if len(items) < 50:
        raise ValueError(f"팀컬러 파싱 건수 비정상: {len(items)}건 (최소 50건 요구)")
    if old_items and len(items) < len(old_items) * 0.75:
        raise ValueError(f"팀컬러 목록 급감: {len(old_items)} → {len(items)}건")
    result = {"source": SOURCE, "updated": dt.datetime.now(KST).isoformat(timespec="seconds"),
              "sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(), "count": len(items),
              "items": items}
    p = Path(data_dir) / "teamcolor" / "teamcolors.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), "utf-8")
    tmp.replace(p)
    return {"teamcolors": len(items), "teamcolors_status": "ok"}
