"""모든 장면의 선택지·결과를 한 표(CSV)로 모은다. 결과 하나가 한 줄.

사용법: python tools/events_to_csv.py   →  docs/events/events.csv
"""
import csv
import json
import re
from pathlib import Path

from events_to_md import fmt_cond, fmt_effects

ROOT = Path(__file__).resolve().parent.parent
REALMS = json.loads((ROOT / "lang/ko/ui.json").read_text(encoding="utf-8"))["realms"]


def clean(s):
    """본문 표시용 기호(**굵게**, <색>, {용어|보이는 글})를 걷어낸다."""
    s = re.sub(r"\{([^{}|]+)\|([^{}]+)\}", r"\2", s)
    s = re.sub(r"\{([^{}]+)\}", r"\1", s)
    s = re.sub(r"</?[a-z]+>", "", s)
    return s.replace("**", "").strip()


def cond_text(cond):
    """경지 숫자를 이름으로 바꿔 조건을 적는다."""
    cond = dict(cond or {})
    lo, hi = cond.pop("realm_min", None), cond.pop("realm_max", None)
    parts = []
    if lo is not None or hi is not None:
        a, b = REALMS[lo or 0], REALMS[hi if hi is not None else len(REALMS) - 1]
        parts.append(a if a == b else f"{a}~{b}")
    rest = fmt_cond(cond)
    if rest:
        parts.append(rest)
    return " / ".join(parts)


def chance_text(o, alone):
    if alone:
        return "100%"
    if "chance" not in o:
        return "나머지"
    s = f"{o['chance']}%"
    if o.get("mods"):
        s += " (" + ", ".join(f"{k} 1당 {v:+g}%p" for k, v in o["mods"].items()) + ")"
    return s


def main():
    batches = json.loads((ROOT / "data/events/index.json").read_text(encoding="utf-8"))["batches"]
    data = {f: json.loads((ROOT / "data/events" / f).read_text(encoding="utf-8")) for f in batches}
    titles = {e["id"]: e["title"] for d in data.values() for e in d["events"]}
    rows = [["묶음", "장면 번호", "장면", "등장 방식", "등장 조건", "선택지", "선택지 조건", "확률", "효과", "결과 첫 줄"]]
    for f, d in data.items():
        for e in d["events"]:
            how = {"chain": "이어지는 장면", "fixed": "고정"}.get(e.get("pool"), "무작위") + (" · 반복" if e.get("repeat") else "")
            for c in e["choices"]:
                tags = ("[마기] " if c.get("madness") else "")
                for o in c["outcomes"]:
                    eff = fmt_effects(o.get("effects", {}))
                    eff = re.sub(r"→ 후속 이벤트 `([^`]+)`", lambda m: f"→ {titles.get(m.group(1), m.group(1))}", eff).replace("**", "")
                    if o.get("poison"):
                        eff += ", 독"
                    first = next((clean(x) for x in o["text"] if x.strip()), "")
                    rows.append([f[:-5], e["id"], e["title"], how, cond_text(e.get("conditions")),
                                 f"{c['id']}. {tags}{clean(c['text'])}", cond_text(c.get("condition")),
                                 chance_text(o, len(c["outcomes"]) == 1), eff, first])
    out = ROOT / "docs/events/events.csv"
    with out.open("w", encoding="utf-8-sig", newline="") as fp:
        csv.writer(fp).writerows(rows)
    print(f"{out.relative_to(ROOT)}: {len(rows) - 1}줄")


if __name__ == "__main__":
    main()
