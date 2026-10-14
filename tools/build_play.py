"""index.html + src/ 모듈 + data/events 를 한 파일(dist/play.html)로 묶는다.
외부 파일을 못 읽는 환경(아티팩트 등)에서 바로 플레이하기 위한 빌드.

사용법: python tools/build_play.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORDER = ["config", "core/rng", "core/state", "events/loader", "events/selector",
         "events/resolver", "meta/lives", "ui/markup", "ui/view", "main"]

def module_body(name):
    src = (ROOT / "src" / f"{name}.js").read_text(encoding="utf-8")
    src = re.sub(r"^import .*?;\s*$", "", src, flags=re.M)
    return re.sub(r"^export ", "", src, flags=re.M)

index = json.loads((ROOT / "data/events/index.json").read_text(encoding="utf-8"))
batches = [json.loads((ROOT / "data/events" / f).read_text(encoding="utf-8")) for f in index["batches"]]
data = json.dumps(batches, ensure_ascii=False).replace("</", "<\\/")
code = "\n".join(module_body(m) for m in ORDER)
script = f"<script>\nwindow.EVENT_DATA = {data};\n(() => {{\n{code}\n}})();\n</script>"

html = (ROOT / "index.html").read_text(encoding="utf-8")
html = html.replace('<script type="module" src="src/main.js"></script>', script)
out = ROOT / "dist" / "play.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"built {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
