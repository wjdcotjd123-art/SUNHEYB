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

## 용어 풀이

- 풀이는 `lang/<언어>/glossary.json`에 `"용어": "풀이"`로 관리
- 본문에서 `{국사}`처럼 감싼 단어에 마우스를 올리면 풀이가 뜸 (`{국사|국사님}` 처럼 보이는 글을 따로 줄 수도 있음)
- `python tools/mark_terms.py data/events/drift_03.json` 을 돌리면 용어집 단어를 글 덩어리마다 처음 한 번 자동 표시
- 빌드할 때 용어집에 없는 표시나 안 쓰는 용어를 알려줌

## 재물 기준값

| 이 세계 돈 | 재물 |
|---|---|
| 동전 한 꾸러미 | 1 |
| 은자 한 냥 | 10 |
| 은원보 하나 | 500 |
| 금원보 하나 | 5,000 |

본문에는 이 세계 돈으로 쓰고, 효과의 `재물` 값은 위 기준으로 환산한다.

## 작성 규칙

- 죽는 결과를 빼고 모든 결과에 눈에 보이는 변화(스탯, 소지품, 인연, 평판, 소속 중 하나 이상)가 있어야 함. 마이너스도 괜찮음
- 인과록은 `data/achievements.json`에 `category`(지역·모임), `cond`(달성 조건), `hint`(달성 전 힌트)와 함께 등록

## 번역

1. `lang/ko/`의 `ui.json`, `events.json`, `achievements.json`, `items.json`을 번역해 `lang/<언어>/`에 같은 이름으로 저장
   - 열쇠(왼쪽)는 그대로 두고 값(오른쪽)만 번역
   - `{n}` 같은 자리표시와 `**`, `<red>` 같은 표기는 그대로 유지
   - `ui.json`의 `stats`, `achievementsScreen.categories` 열쇠는 내부 이름이므로 바꾸지 않음
   - 예외로 `glossary.json`의 열쇠는 그 언어로 바꾸고, 번역된 본문의 `{용어}` 표시와 같은 글자로 맞출 것
   - `glossary.json`, `names.json`도 함께 번역
2. `src/config.js`의 `languages`에 언어 코드 추가 (예: `["ko", "en"]`)
3. 설정 화면에 언어 선택이 자동으로 나타남
