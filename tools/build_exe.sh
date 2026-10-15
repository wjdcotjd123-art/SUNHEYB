#!/bin/sh
# 윈도우 실행 프로그램 만들기: dist/play.html을 electron/game/에 넣고 electron-packager로 묶는다.
# 결과: release/선협-win32-x64.zip (압축을 풀고 선협.exe 실행)
set -e
cd "$(dirname "$0")/.."
python3 tools/build_play.py
mkdir -p electron/game release
cp dist/play.html electron/game/index.html
VERSION=$(grep -o '## v[0-9.]*' CHANGELOG.md | head -1 | cut -c5-)
node -e "const p=require('./electron/package.json');p.version='$VERSION';require('fs').writeFileSync('electron/package.json',JSON.stringify(p,null,2)+'\n')"
npx --yes @electron/packager@18.3.6 electron "선협" --platform=win32 --arch=x64 --out=release --overwrite --electron-version=33.2.1 --app-version="$VERSION"
cd release && rm -f "선협-win32-x64.zip" && zip -qr "선협-win32-x64.zip" "선협-win32-x64"
echo "built release/선협-win32-x64.zip"
