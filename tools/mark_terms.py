"""용어집(lang/ko/glossary.json)에 있는 단어를 이벤트 원본 본문에서 찾아 {용어}로 표시한다.

- 글 덩어리(장면 본문, 선택 항목, 결과 하나)마다 처음 나오는 곳 한 번만 표시
- 이미 표시된 용어는 건드리지 않음 (여러 번 돌려도 안전)
- 긴 용어부터 표시 (혈마공을 먼저 표시해서 마공이 그 안에 끼지 않게)
- 표시하면 안 되는 곳이 있으면 표시 후 원본에서 직접 {} 를 지우면 된다

사용법: python tools/mark_terms.py data/events/drift_03.json
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def outside_braces(text, pos):
    return text.rfind("{", 0, pos) <= text.rfind("}", 0, pos)


def mark_block(lines, terms):
    """lines: 문자열 목록. 바뀐 목록을 돌려준다."""
    joined = "\n".join(lines)
    for term in terms:
        if re.search(r"\{" + re.escape(term) + r"[|}]", joined):
            continue
        for m in re.finditer(re.escape(term), joined):
            if outside_braces(joined, m.start()):
                joined = joined[: m.start()] + "{" + term + "}" + joined[m.end():]
                break
    return joined.split("\n")


def main(paths):
    glossary = json.loads((ROOT / "lang/ko/glossary.json").read_text(encoding="utf-8"))
    terms = sorted(glossary, key=len, reverse=True)
    for p in paths:
        p = pathlib.Path(p)
        data = json.loads(p.read_text(encoding="utf-8"))
        for ev in data["events"]:
            ev["description"] = mark_block(ev["description"], terms)
            for c in ev["choices"]:
                c["text"] = mark_block([c["text"]], terms)[0]
                for o in c["outcomes"]:
                    o["text"] = mark_block(o["text"], terms)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("marked", p.name)


if __name__ == "__main__":
    main(sys.argv[1:])
