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


def collect_items(node, out):
    if isinstance(node, dict):
        for k, v in node.items():
            if k in ("items", "items_remove") and isinstance(v, list):
                out.update(v)
            else:
                collect_items(v, out)
    elif isinstance(node, list):
        for v in node:
            collect_items(v, out)


def main():
    index = read(ROOT / "data/events/index.json")
    events, items = {}, set()
    for f in index["batches"]:
        for ev in read(ROOT / "data/events" / f)["events"]:
            i = ev["id"]
            events[f"{i}.title"] = ev["title"]
            events[f"{i}.desc"] = ev["description"]
            for c in ev["choices"]:
                events[f"{i}.c{c['id']}.tag"] = c["tag"]
                events[f"{i}.c{c['id']}.text"] = c["text"]
                for k, o in enumerate(c["outcomes"]):
                    events[f"{i}.c{c['id']}.o{k}"] = o["text"]
            collect_items(ev, items)
    write(LANG / "events.json", events)

    ach = {}
    for a in read(ROOT / "data/achievements.json")["achievements"]:
        for field in ("name", "desc", "hint"):
            ach[f"{a['id']}.{field}"] = a[field]
    write(LANG / "achievements.json", ach)

    config = (ROOT / "src/config.js").read_text(encoding="utf-8")
    m = re.search(r"startItems:\s*\[([^\]]*)\]", config)
    if m:
        items.update(re.findall(r'"([^"]+)"', m.group(1)))
    items_path = LANG / "items.json"
    names = read(items_path) if items_path.exists() else {}
    for it in sorted(items):
        names.setdefault(it, it.replace("_", " "))
    write(items_path, names)

    print(f"events {len(events)} · achievements {len(ach)} · items {len(names)} → {LANG.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
