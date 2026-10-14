"""이벤트 JSON을 사람이 읽기 쉬운 마크다운으로 변환한다.

사용법: python tools/events_to_md.py data/events/drift_01.json docs/events/drift_01.md
"""
import json
import sys

TYPE_LABEL = {"minor": "사소", "major": "큰"}


def fmt_cond(cond):
    parts = []
    if "items" in cond:
        parts.append("보유: " + ", ".join(cond["items"]))
    if "flags" in cond:
        parts.append("조건: " + ", ".join(cond["flags"]))
    if "realm_min" in cond:
        parts.append(f"경지 {cond['realm_min']} 이상(삼류↑)")
    return " / ".join(parts)


def fmt_effects(eff):
    if not eff:
        return "변화 없음"
    parts = []
    for k, v in eff.items():
        if k == "death":
            parts.append("**사망**")
        elif k == "items":
            parts.append("획득: " + ", ".join(v))
        elif k == "items_remove":
            parts.append("소모: " + ", ".join(v))
        elif k == "items_clear":
            parts.append("소지품 전부 잃음")
        elif k == "flags":
            parts.append("플래그: " + ", ".join(v))
        elif k == "next_event":
            parts.append(f"→ 후속 이벤트 `{v}`")
        elif k == "achievement":
            parts.append(f"인과록: {v}")
        elif k == "인연":
            parts.append(", ".join(f"인연 {n} +{p}" for n, p in v.items()))
        elif k.endswith("_set"):
            parts.append(f"{k[:-4]} = {v}")
        else:
            parts.append(f"{k} {v:+d}")
    return ", ".join(parts)


def fmt_chance(o):
    if "chance" not in o:
        return "나머지"
    s = f"{o['chance']}%"
    if o.get("mods"):
        s += " (" + ", ".join(f"{k} 1당 {v:+d}%p" for k, v in o["mods"].items()) + ")"
    return s


def render(data):
    out = [f"# {data['chapter']} · {data['part']} · {data['phase']} — {data['batch']}", "", f"> {data['note']}", ""]
    for ev in data["events"]:
        out += [f"## {ev['id']} {ev['title']} `{TYPE_LABEL[ev['type']]}`", "", "### A. 이벤트", ""]
        out += [line + "  " if line else "" for line in ev["description"]]
        out += ["", "### B. 선택지", ""]
        for c in ev["choices"]:
            cond = f" *({fmt_cond(c['condition'])})*" if c.get("condition") else ""
            out.append(f"{c['id']}. {c['text']}{cond}")
        out += ["", "### C. 결과", ""]
        for c in ev["choices"]:
            out.append(f"**{c['id']}. {c['text']}**")
            out.append("")
            for o in c["outcomes"]:
                out.append(f"- 확률 {fmt_chance(o)} → {fmt_effects(o['effects'])}")
                out.append("")
                out += ["  > " + line + "  " if line else "  >" for line in o["text"]]
                out.append("")
        out += ["---", ""]
    return "\n".join(out)


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    with open(dst, "w", encoding="utf-8") as f:
        f.write(render(data))
