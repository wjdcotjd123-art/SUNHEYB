# 선협 (가제)

현대인이 선협 세계에 떨어져 살아남는 선택지형 텍스트 게임.

## 폴더

| 폴더 | 내용 |
|---|---|
| `data/events/` | 이벤트 원본 (한국어로 작성). 확률·조건·효과와 한국어 글이 함께 있음 |
| `data/achievements.json` | 인과록(업적) 원본 |
| `lang/<언어>/` | 화면에 나가는 글만 모은 언어 파일 |
| `docs/events/` | 기획 검토용 문서 (원본에서 자동 생성) |
| `src/` | 게임 코드 (기능별 모듈) |
| `tools/` | 변환·빌드 도구 |

## 작업 순서

1. 이벤트는 `data/events/*.json`에 작성하고, 새 묶음이면 `data/events/index.json`에 추가
2. `python tools/build_play.py` 실행
   - `lang/ko/`의 글이 원본에서 다시 뽑히고
   - `dist/play.html`(한 파일짜리 시험판)이 만들어짐
3. 검토 문서가 필요하면 `python tools/events_to_md.py data/events/drift_01.json docs/events/drift_01.md`

## 본문 표기

- `**굵게**`
- 색: `<red>` 위험·피해, `<purple>` 독·마기, `<green>` 획득·상승, `<gold>` 기연·희귀

## 번역

1. `lang/ko/`의 `ui.json`, `events.json`, `achievements.json`, `items.json`을 번역해 `lang/<언어>/`에 같은 이름으로 저장
   - 열쇠(왼쪽)는 그대로 두고 값(오른쪽)만 번역
   - `{n}` 같은 자리표시와 `**`, `<red>` 같은 표기는 그대로 유지
   - `ui.json`의 `stats` 열쇠(체력 등)는 내부 이름이므로 바꾸지 않음
2. `src/config.js`의 `languages`에 언어 코드 추가 (예: `["ko", "en"]`)
3. 설정 화면에 언어 선택이 자동으로 나타남
