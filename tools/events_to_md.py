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
    if "items_none" in cond:
        parts.append("없어야 함(소지품): " + ", ".join(cond["items_none"]))
    if "flags" in cond:
        parts.append("조건: " + ", ".join(cond["flags"]))
    if "flags_any" in cond:
        parts.append("하나라도: " + ", ".join(cond["flags_any"]))
    if "flags_none" in cond:
        parts.append("없어야 함: " + ", ".join(cond["flags_none"]))
    if "flags_count" in cond:
        fc = cond["flags_count"]
        rng = f"{fc.get('min', 0)}~{fc['max']}" if "max" in fc and fc["max"] != fc.get("min") else f"{fc.get('min', 0)}"
        parts.append(f"{', '.join(fc['of'])} 중 {rng}개")
    if "any" in cond:
        parts.append("다음 중 하나: (" + ") 또는 (".join(fmt_cond(c) for c in cond["any"]) + ")")
    if "none_of" in cond:
        parts.append("다음 모두 아님: (" + "), (".join(fmt_cond(c) for c in cond["none_of"]) + ")")
    if "stat_min" in cond:
        parts.append(", ".join(f"{k} {v} 이상" for k, v in cond["stat_min"].items()))
    if "stat_min_any" in cond:
        parts.append(" 또는 ".join(f"{k} {v} 이상" for k, v in cond["stat_min_any"].items()))
    if "realm_min" in cond:
        parts.append(f"경지 {cond['realm_min']} 이상")
    if "realm_max" in cond:
        parts.append(f"경지 {cond['realm_max']} 이하")
    if "affiliation" in cond:
        parts.append(f"소속: {cond['affiliation']}")
    if "bond_min" in cond:
        parts.append(", ".join(f"인연 {k} {v} 이상" for k, v in cond["bond_min"].items()))
    if "past_bond_min" in cond:
        parts.append(", ".join(f"전생 인연 {k} {v} 이상" for k, v in cond["past_bond_min"].items()))
    if "traits" in cond:
        parts.append("체질: " + ", ".join(cond["traits"]))
    if "affiliation_not" in cond:
        parts.append("소속 아님: " + ", ".join(cond["affiliation_not"]))
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
        elif k == "flags_remove":
            parts.append("플래그 제거: " + ", ".join(v))
        elif k == "if":
            parts.append("; ".join(f"[조건 {json.dumps(c.get('when', {}), ensure_ascii=False)} → {fmt_effects(c.get('effects', {}))}]" for c in v))
        elif k == "전투":
            parts.append(f"⚔ 전투 `{v['enemy']}` (목숨 {'걺' if v.get('lethal', True) else '안 걺'}) · 승리: {fmt_effects(v['win'].get('effects', {}))} · 패배: {fmt_effects(v['lose'].get('effects', {}))}")
        elif isinstance(v, dict):
            parts.append(", ".join(f"{k} {n} {p:+d}" for n, p in v.items()))
        elif isinstance(v, str):
            parts.append(f"{k} = {v}")
        elif k.endswith("_set"):
            parts.append(f"{k[:-4]} = {v}")
        elif isinstance(v, bool):
            parts.append(k)
        else:
            parts.append(f"{k} {v:+d}")
    return ", ".join(parts)


def fmt_chance(o):
    if "chance" not in o:
        return "나머지"
    s = f"{o['chance']}%"
    if o.get("mods"):
        s += " (" + ", ".join(f"{k} 1당 {v:+g}%p" for k, v in o["mods"].items()) + ")"
    if o.get("flagMods"):
        s += " (" + ", ".join(f"{k} 있으면 {v:+g}%p" for k, v in o["flagMods"].items()) + ")"
    return s


def render(data):
    out = [f"# {data['chapter']} · {data['part']} · {data['phase']} — {data['batch']}", "", f"> {data['note']}", ""]
    for ev in data["events"]:
        tag = {"chain": " `연결 전용`", "fixed": " `고정`"}.get(ev.get("pool"), "") + (" `반복`" if ev.get("repeat") else "")
        out += [f"## {ev['id']} {ev['title']} `{TYPE_LABEL[ev['type']]}`{tag}", ""]
        if ev.get("conditions"):
            out += [f"*등장 조건 — {fmt_cond(ev['conditions'])}*", ""]
        out += ["### A. 이벤트", ""]
        out += [line + "  " if line else "" for line in ev["description"]]
        out += ["", "### B. 선택지", ""]
        for c in ev["choices"]:
            cond = f" *({fmt_cond(c['condition'])})*" if c.get("condition") else ""
            out.append(f"{c['id']}. [{c['tag']}] {c['text']}{cond}")
        out += ["", "### C. 결과", ""]
        for c in ev["choices"]:
            out.append(f"**{c['id']}. [{c['tag']}] {c['text']}**")
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
