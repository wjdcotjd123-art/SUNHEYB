# 줄기 읽기용: 장면 id들을 받아 설명과 선택지별 결과 글을 이어 붙여 보여 준다.
# 사용: python3 tools/chain_text.py Q33 S05 S13 K03 S17
import json, glob, re, sys
ev = {}
for p in glob.glob("data/events/*.json"):
    d = json.load(open(p, encoding="utf-8"))
    for e in d.get("events", []): ev[e["id"]] = e
plain = lambda t: re.sub(r"\*\*|</?\w+>", "", t)
for eid in sys.argv[1:]:
    e = ev[eid]
    print(f"\n#### {eid} {e['title']}  조건 {json.dumps(e.get('conditions', {}), ensure_ascii=False)}")
    print(" / ".join(plain(t) for t in e["description"] if t))
    for c in e["choices"]:
        for o in c["outcomes"]:
            fl = o["effects"].get("flags", [])
            print(f"  - [{c['id']}] {c['text']} {json.dumps(c.get('condition', ''), ensure_ascii=False) if c.get('condition') else ''} → {fl}")
            print("    " + " / ".join(plain(t) for t in o["text"] if t)[:700])
    for v in e.get("variants", []):
        print(f"  * 갈래 {json.dumps(v['when'], ensure_ascii=False)}: " + " | ".join(f"{plain(k)[:30]} → {' / '.join(plain(x) for x in r)[:120]}" for k, r in v.get("lines", {}).items()))
