"""index.html + src/ 모듈 + data/ + lang/ 을 한 파일(dist/play.html)로 묶는다.
외부 파일을 못 읽는 환경(아티팩트 등)에서 바로 플레이하기 위한 빌드.

사용법: python tools/build_play.py            (시험판: dist/play.html)
        python tools/build_play.py --release  (배포판: dist/선협.html — 시험용 업 버튼·전투 시험 없음)
"""
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
subprocess.run([sys.executable, str(ROOT / "tools/extract_text.py")], check=True)
ORDER = ["config", "core/store", "core/rng", "core/state", "events/loader", "events/selector", "events/novelty",
         "events/resolver", "combat/battle", "i18n/i18n", "meta/lives", "meta/shop", "meta/settings", "save/saveManager",
         "audio/sound", "ui/keys", "ui/markup", "ui/tooltip", "ui/view", "ui/battle", "ui/screens", "main"]

def module_body(name):
    src = (ROOT / "src" / f"{name}.js").read_text(encoding="utf-8")
    src = re.sub(r"^import .*?;\s*$", "", src, flags=re.M)
    return re.sub(r"^export ", "", src, flags=re.M)

index = json.loads((ROOT / "data/events/index.json").read_text(encoding="utf-8"))
batches = [json.loads((ROOT / "data/events" / f).read_text(encoding="utf-8")) for f in index["batches"]]
data = json.dumps(batches, ensure_ascii=False).replace("</", "<\\/")
codex = (ROOT / "data/codex.json").read_text(encoding="utf-8").replace("</", "<\\/")
ach = (ROOT / "data/achievements.json").read_text(encoding="utf-8").replace("</", "<\\/")
combat = (ROOT / "data/combat.json").read_text(encoding="utf-8").replace("</", "<\\/")
langs = {}
for d in sorted((ROOT / "lang").iterdir()):
    if d.is_dir():
        langs[d.name] = {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in d.glob("*.json")}
lang_data = json.dumps(langs, ensure_ascii=False).replace("</", "<\\/")
code = "\n".join(module_body(m) for m in ORDER)
RELEASE = "--release" in sys.argv
if RELEASE:
    # 배포판: 시험용 기능(업 버튼, 전투 시험)을 끈다
    code = re.sub(r"testKarma: \d+", "testKarma: 0", code)
script = f"<script>\nwindow.EVENT_DATA = {data};\nwindow.ACHIEVEMENT_DATA = {ach};\nwindow.CODEX_DATA = {codex};\nwindow.COMBAT_DATA = {combat};\nwindow.LANG_DATA = {lang_data};\n(() => {{\n{code}\n}})();\n</script>"

html = (ROOT / "index.html").read_text(encoding="utf-8")
# 그림 파일(assets/)은 한 파일 빌드에 data URI로 넣는다
import base64
for img in (ROOT / "assets").glob("*"):
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(img.suffix.lower())
    if mime:
        html = html.replace(f"assets/{img.name}", f"data:{mime};base64," + base64.b64encode(img.read_bytes()).decode())
html = html.replace('<script type="module" src="src/main.js"></script>', script)
out = ROOT / "dist" / ("선협.html" if RELEASE else "play.html")
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print(f"built {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
