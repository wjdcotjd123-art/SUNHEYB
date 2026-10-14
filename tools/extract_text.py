"""이벤트·인과록 원본(한국어)에서 화면에 나갈 글만 뽑아 lang/ko/ 언어 파일을 만든다.

- 원본(data/)은 그대로 두고 작성·수정은 원본에서 한다.
- 번역은 lang/ko/*.json 을 AI에 넘겨 lang/<언어>/*.json 을 만들면 된다.
  숫자·확률·조건은 언어 파일에 들어가지 않으므로 번역 중에 건드려질 일이 없다.
- 소지품 이름(items.json)은 이미 적어둔 이름은 유지하고, 새 소지품만 추가한다.

사용법: python tools/extract_text.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
LANG = ROOT / "lang" / "ko"


def read(p):
    return json.loads(p.read_text(encoding="utf-8"))


def write(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def collect(node, items, names):
    """소지품 id와 인물·세력 id(인연·평판·소속)를 모은다."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("items", "items_remove") and isinstance(v, list):
                items.update(v)
            elif k in ("인연", "평판") and isinstance(v, dict):
                names.update(v.keys())
            elif k == "소속" and isinstance(v, str):
                names.add(v)
            else:
                collect(v, items, names)
    elif isinstance(node, list):
        for v in node:
            collect(v, items, names)


def merge_names(path, ids):
    """이미 적어둔 표시 이름은 유지하고 새 id만 기본 이름으로 추가."""
    data = read(path) if path.exists() else {}
    for i in sorted(ids):
        data.setdefault(i, i.replace("_", " "))
    write(path, data)
    return data


def main():
    index = read(ROOT / "data/events/index.json")
    events, items, names = {}, set(), set()
    for f in index["batches"]:
        for ev in read(ROOT / "data/events" / f)["events"]:
            i = ev["id"]
            events[f"{i}.title"] = ev["title"]
            events[f"{i}.desc"] = ev["description"]
            if "intro" in ev:
                events[f"{i}.intro"] = ev["intro"]
            for c in ev["choices"]:
                events[f"{i}.c{c['id']}.tag"] = c["tag"]
                events[f"{i}.c{c['id']}.text"] = c["text"]
                for k, o in enumerate(c["outcomes"]):
                    events[f"{i}.c{c['id']}.o{k}"] = o["text"]
            collect(ev, items, names)
    write(LANG / "events.json", events)

    ach = {}
    for a in read(ROOT / "data/achievements.json")["achievements"]:
        for field in ("name", "desc", "hint", "cond"):
            ach[f"{a['id']}.{field}"] = a[field]
    write(LANG / "achievements.json", ach)

    codex = {}
    for sec in read(ROOT / "data/codex.json")["sections"]:
        for e in sec["entries"]:
            codex[f"{e['id']}.name"] = e["name"]
            for n, st in enumerate(e["stages"]):
                codex[f"{e['id']}.s{n}"] = st["text"]
    write(LANG / "codex.json", codex)

    config = (ROOT / "src/config.js").read_text(encoding="utf-8")
    m = re.search(r"startItems:\s*\[([^\]]*)\]", config)
    if m:
        items.update(re.findall(r'"([^"]+)"', m.group(1)))
    item_names = merge_names(LANG / "items.json", items)
    who_names = merge_names(LANG / "names.json", names)

    # 본문의 {용어} 표시를 모아 용어집에 없는 것을 알려준다.
    gpath = LANG / "glossary.json"
    glossary = read(gpath) if gpath.exists() else {}
    used = set()
    for v in events.values():
        for line in (v if isinstance(v, list) else [v]):
            used.update(t.split("|")[0] for t in re.findall(r"\{([^{}]+)\}", line))
    missing = sorted(used - set(glossary))
    unused = sorted(set(glossary) - used)

    print(f"events {len(events)} · achievements {len(ach)} · items {len(item_names)} · names {len(who_names)} · glossary {len(glossary)} → {LANG.relative_to(ROOT)}")
    if missing:
        print("  용어집에 없는 표시:", ", ".join(missing))
    if unused:
        print("  본문에서 안 쓰는 용어:", ", ".join(unused))


if __name__ == "__main__":
    main()
