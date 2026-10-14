"""index.html + src/ 모듈 + data/ + lang/ 을 한 파일(dist/play.html)로 묶는다.
외부 파일을 못 읽는 환경(아티팩트 등)에서 바로 플레이하기 위한 빌드.

사용법: python tools/build_play.py
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(ROOT / "tools/extract_text.py")], check=True)
ORDER = ["config", "core/store", "core/rng", "core/state", "events/loader", "events/selector", "events/novelty",
         "events/resolver", "i18n/i18n", "meta/lives", "meta/shop", "meta/settings", "save/saveManager",
         "ui/keys", "ui/markup", "ui/tooltip", "ui/view", "ui/screens", "main"]

def module_body(name):
    src = (ROOT / "src" / f"{name}.js").read_text(encoding="utf-8")
    src = re.sub(r"^import .*?;\s*$", "", src, flags=re.M)
    return re.sub(r"^export ", "", src, flags=re.M)

index = json.loads((ROOT / "data/events/index.json").read_text(encoding="utf-8"))
batches = [json.loads((ROOT / "data/events" / f).read_text(encoding="utf-8")) for f in index["batches"]]
data = json.dumps(batches, ensure_ascii=False).replace("</", "<\\/")
codex = (ROOT / "data/codex.json").read_text(encoding="utf-8").replace("</", "<\\/")
ach = (ROOT / "data/achievements.json").read_text(encoding="utf-8").replace("</", "<\\/")
langs = {}
for d in sorted((ROOT / "lang").iterdir()):
    if d.is_dir():
        langs[d.name] = {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in d.glob("*.json")}
lang_data = json.dumps(langs, ensure_ascii=False).replace("</", "<\\/")
code = "\n".join(module_body(m) for m in ORDER)
script = f"<script>\nwindow.EVENT_DATA = {data};\nwindow.ACHIEVEMENT_DATA = {ach};\nwindow.CODEX_DATA = {codex};\nwindow.LANG_DATA = {lang_data};\n(() => {{\n{code}\n}})();\n</script>"

html = (ROOT / "index.html").read_text(encoding="utf-8")
html = html.replace('<script type="module" src="src/main.js"></script>', script)
out = ROOT / "dist" / "play.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"built {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
