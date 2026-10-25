"""무협 장면을 읽기 좋은 문서로 만든다: docs/무협_장면/<파일>.md
쓰는 법: python tools/doc_mu.py
읽기 전용이다. 고칠 때는 data/events/*.json을 고친다(문서는 빌드 때 다시 만든다)."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "무협_장면"
OUT.mkdir(parents=True, exist_ok=True)
NAMES = {"m01.json": "첫 삶 (벼락·노인·마을)", "m02.json": "와우촌·백운무관", "m03.json": "녹풍채"}

def cond_text(c):
    if not c: return ""
    parts = []
    if c.get("flags"): parts.append("있어야: " + ", ".join(c["flags"]))
    if c.get("flags_any"): parts.append("하나라도: " + ", ".join(c["flags_any"]))
    if c.get("flags_none"): parts.append("없어야: " + ", ".join(c["flags_none"]))
    for k, lab in (("stat_min", "능력치"), ("bond_min", "인연")):
        if c.get(k): parts.append(lab + " " + ", ".join(f"{a} {b} 이상" for a, b in c[k].items()))
    if c.get("realm_min") is not None: parts.append(f"경지 {c['realm_min']} 이상")
    if c.get("realm_max") is not None: parts.append(f"경지 {c['realm_max']} 이하")
    if c.get("scenes_min"): parts.append(f"장면 {c['scenes_min']}개 이후")
    if c.get("items"): parts.append("소지품: " + ", ".join(c["items"]))
    for k in ("any", "none_of", "flags_count"):
        if c.get(k): parts.append(f"{k}: " + json.dumps(c[k], ensure_ascii=False))
    return " / ".join(parts)

def eff_text(e):
    if not e: return ""
    out = []
    for k, v in e.items():
        if k == "if": out.append("조건부 표시")
        elif k == "death": out.append("**죽음**")
        elif k == "ending": out.append(f"**귀결: {v}**")
        elif k == "next_event": out.append(f"→ {v}")
        elif k == "flags": out.append("표시 " + ", ".join(v))
        elif k == "인연": out.append("인연 " + ", ".join(f"{a} {b:+}" for a, b in v.items()))
        elif k == "갈래": out.append(f"갈래 {v}")
        elif isinstance(v, (int, float)) and not isinstance(v, bool): out.append(f"{k} {v:+}")
        else: out.append(f"{k} {v}")
    return " · ".join(out)

def lines(ls):
    return "\n".join(("> " + l + "  ") if l else ">" for l in ls)

for f, title in NAMES.items():
    d = json.loads((ROOT / "data/events" / f).read_text(encoding="utf-8"))
    md = [f"# {title}", "", f"원본: `data/events/{f}` (고칠 때는 원본을 고친다)", ""]
    toc = [f"- [{e['id']} {e['title']}](#{e['id'].lower()}-{e['title'].replace(' ', '-')})" for e in d["events"]]
    md += toc + [""]
    for e in d["events"]:
        md.append(f"## {e['id']} {e['title']}")
        meta = []
        if e.get("path"): meta.append(f"갈래 {e['path']}")
        meta.append({"pool": "무작위", "chain": "이어지는 장면", "fixed": "고정"}.get(e.get("pool", "pool"), e.get("pool")))
        if e.get("repeat"): meta.append("반복")
        if e.get("auto"): meta.append("귀결(선택지 없음)")
        ct = cond_text(e.get("conditions"))
        md.append(f"*{' · '.join(meta)}{(' — ' + ct) if ct else ''}*")
        md += ["", lines(e["description"]), ""]
        for c in e["choices"]:
            cc = cond_text(c.get("condition"))
            stat = f" [{c['stat']}]" if c.get("stat") else ""
            md.append(f"**{c['id']}. {c['text']}**{stat}" + (f"  \n*({cc})*" if cc else ""))
            md.append("")
            for o in c["outcomes"]:
                ch = f"{o['chance']}%" if o.get("chance") is not None else "나머지"
                md.append(f"- 확률 {ch} — {eff_text(o.get('effects'))}" + (f" *(조건: {cond_text(o['when'])})*" if o.get("when") else ""))
                md.append("")
                md.append(lines(o["text"]))
                md.append("")
        for v in e.get("variants", []):
            md.append(f"<details><summary>글 갈래 — {cond_text(v.get('when'))}</summary>")
            md.append("")
            for k, vals in v.get("lines", {}).items():
                md.append(f"- 「{k}」 → " + (" / ".join(f"「{x}」" for x in vals) if vals else "(지움)"))
            if v.get("terms"): md.append("- 낱말 바꿈: " + ", ".join(f"{a} → {b}" for a, b in v["terms"].items()))
            md += ["", "</details>", ""]
        md.append("---")
        md.append("")
    (OUT / f.replace(".json", ".md")).write_text("\n".join(md), encoding="utf-8")
(OUT / "README.md").write_text("# 무협 장면 읽기용 문서\n\n" + "\n".join(f"- [{t}]({f.replace('.json', '.md')})" for f, t in NAMES.items()) + "\n\n읽기 전용입니다. 고칠 때는 `data/events/` 의 원본 JSON을 고치세요. 이 문서는 `python tools/doc_mu.py`로 다시 만듭니다.\n", encoding="utf-8")
print("docs/무협_장면 만듦")
