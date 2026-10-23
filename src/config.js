// 게임 전체 설정값. 숫자는 여기서만 바꾼다.
export const CONFIG = {
  startStats: { 체력: 10, 최대체력: 10, 근골: 3, 민첩: 3, 행운: 3, 재물: 0, 내공: 0, 경지: 0 },
  disabledStats: [], // 없앤 능력치: 장면 데이터에 남아 있어도 적용하지 않는다
  // 체력 회복·피해 단계: 최대 체력에 대한 비율 (화면에는 문장만)
  hpTiers: { 회복: { 조금: 0.2, 제법: 0.5, 완전: 1 }, 피해: { 가볍게: 0.1, 크게: 0.3, 치명: 0.6 } },
  startItems: ["라이터"],
  defaultWeight: 5,
  affiliationBoost: 4,
  // 새로움: 모든 생을 통틀어 안 본 장면 ×unseen. 본 장면이라도 못 본 결과·못 딴 업적·안 열린 도감 항목이 남았으면 각각 곱한다
  novelty: { unseen: 3, outcome: 1.5, achievement: 1.5, codex: 1.5, minChance: 15 },
  // 정사 치우침: 한쪽으로 기울면 반대쪽 인물 장면 가중치 ×factor (sides.js)
  sides: { people: { 정파: ["연화린", "남궁현"], 사파: ["소월", "철우강"] }, sideFlags: { 정파: "편_무림맹", 사파: "편_사도련" }, repGap: 30, bond: 40, factor: 0.25 },
  personBoost: { perBond: 25, max: 5 }, // 인연 있는 인물의 장면: 인연 25당 +1배, 최대 ×5 // 소속과 같은 group 장면의 등장 가중치 배수
  rareChance: 5, // 기본 확률이 이 값(%) 이하인 생존 결과는 '드문 인과'
  // 전생의 기억: 같은 선택지에서 죽은 횟수당 생존 확률 +perDeath %p (최대 cap). 대박 결과는 횟수당 ×(1+rarePerDeath)
  deathMemory: { perDeath: 2, cap: 10, rarePerDeath: 0.1, rareCap: 0.5 },
  termLimit: 2, // 용어 밑줄: 한 생에 용어당 최대 표시 횟수
  chanceMin: 2,
  // 무기: 가지고 있으면 능력치 보너스 (여러 자루면 보너스 합이 가장 큰 하나만)
  weapons: {
    녹슨_손칼: { 근골: 1 }, 석두의_목검: { 근골: 1 },
    맞춤_장검: { 근골: 3 }, 노도의_칼: { 근골: 3 }, 석두가_벼린_칼: { 근골: 3 }, 유진의_은장도: { 민첩: 3 },
    청강검: { 근골: 6 }, 매화_문양의_고검: { 근골: 6 },
    노검객의_칼: { 근골: 4, 민첩: 4 },
    백련강_장검: { 근골: 5 }, 추운검: { 근골: 8 },
  },
  // 연계의 다음 장면 가중치 배율
  chainBoost: 3,
  // 정체: 벽을 넘을 내공(walls[경지])을 갖추고도 limit장 넘게 머물면 그 경지에서는 능력치가 더 오르지 않는다
  stagnation: { walls: { 1: 8, 2: 18, 3: 30, 4: 45, 5: 50, 6: 70 }, limit: 12, stats: ["근골", "민첩", "행운", "내공"] },
  // 지금 상태에서 죽을 확률이 이 값(%) 이상인 선택지는 비추천으로 표시
  pageChars: 260, // 장면 본문이 이보다 길면 쪽으로 나눈다(대략 글자 수)
  warnDeath: 999, // 비추천 표시 꺼 둠(켜려면 70)
  chanceMax: 95,
  languages: ["ko"],
  defaultLanguage: "ko",
  langDir: "lang",
  shownStats: ["체력", "근골", "민첩", "행운", "내공", "재물"],
  karma: { perScene: 1, perNewOutcome: 2, perAchievement: 5, perRealm: 3, wealthPer: 50, perRare: 5, perEnding: 40, perSceneMult: 0.03, maxMult: 2.5 }, // 배율 = 1 + 턴×0.03 (최대 ×2.5)
  // 업 상점: 산 만큼 매 생 시작할 때 적용. 값 = round(base × growth^현재단계)
  shop: [],
  // 체질: 한 번 사면 모든 생에 유지, 켜고 끌 수 있다.
  // blocks: 이 표시가 달린 결과(예: "food": true)가 나오면 그 결과를 빼고 다시 굴리고, 결과 화면에 체질 발동을 표시한다
  // tiers: 단계별 이름(언어 파일 karmaScreen.traits.<이름>), 값, 막는 결과 표시
  traits: [],
  // 기억: 장(章)의 끝을 보면 업에 나타나는 것. unlock 귀결을 본 적이 있어야 보인다. 켜 두면 flag가 새 생에 붙는다
  memories: [
    { id: "언어", price: 10, unlock: "flag:말_트임", flag: "기억_언어" },
    // 업에 새긴 무공(업 화면의 '무공' 탭): 숨은 숙련이 기준을 넘으면 생이 끝날 때 나타난다
    { id: "삼재검법", price: 30, unlock: "flag:삼재_숙련", flag: "업_삼재", learn: "삼재_앎", tab: "arts" },
    { id: "토납법", price: 30, unlock: "flag:토납_숙련", flag: "업_토납", learn: "토납_앎", tab: "arts" },
    { id: "녹풍도법", price: 30, unlock: "flag:녹풍도_극의", flag: "업_녹풍도", learn: "녹풍도_앎", also: ["녹풍도_숙련"], tab: "arts" },
  ],
  testKarma: 50000, // 시험용: 설정 화면에서 업을 넣는 버튼 (0이면 버튼 숨김, 출시 전 0으로)
  // 전투: 명중 = baseHit + (내 민첩 - 상대 민첩)×perAgi - 상대 행운×perLuckEvade + 경지 차×perRealmHit (minHit~maxHit)
  // 피해 = (1 + 근골×perStr + 경지 우위×perRealmDmg) × (무공 배율) × 0.85~1.15, 치명타 = baseCrit + 행운×perLuckCrit (피해 2배), 방어 = 받는 피해 guard만큼 감소
  combat: { baseHit: 75, perAgi: 3, perLuckEvade: 1, perRealmHit: 8, minHit: 15, maxHit: 95, perStr: 0.5, perRealmDmg: 1, baseCrit: 5, perLuckCrit: 2, guard: 0.7, lineDelay: 1000 },
  combatEnabled: false, // false면 전투 화면 없이 속으로 싸움을 계산해 결과만 보여 준다
  combatPath: "data/combat.json",
  // 마기: 마공 선택지를 고를 때마다 쌓이는 숨은 수치. threshold 이상이 되면 다음 장면으로 마두 발작(event)이 터진다
  madness: { stat: "마기", threshold: 10, event: "SYS_MADNESS" },
  testBattleEnemy: "고갯길_산적", // 시험용 전투의 적
  showLog: false, // 하단 '지나온 길' 기록창
  storage: { meta: "sunheyb.meta.v1", save: "sunheyb.save.v2", settings: "sunheyb.settings.v1" },
  prologueId: "M001", // 매 생의 첫 장면
  // 경지별 마지막 장면: 그 경지에서 더 나올 장면이 없으면 생을 끝내는 대신 한 번 띄운다
  fallbackEvents: { 0: "V010", 1: "V010" },
  // 검은 비늘: 지니고 있으면 weak=true인 죽음(수준 낮은 적의 공격)을 한 번 막아준다
  scaleGuard: { item: "검은_비늘", event: "SYS_SCALE", usedFlag: "비늘이_막음" }, // 한 생에 한 번만
  eventIndex: "data/events/index.json",
  achievementsPath: "data/achievements.json",
  codexPath: "data/codex.json",
};
