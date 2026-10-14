// 게임 전체 설정값. 숫자는 여기서만 바꾼다.
export const CONFIG = {
  startStats: { 체력: 10, 근골: 3, 민첩: 3, 재물: 0, 내공: 0, 경지: 0 },
  startItems: ["라이터"],
  defaultWeight: 5,
  affiliationBoost: 4, // 소속과 같은 group 장면의 등장 가중치 배수
  rareChance: 5, // 기본 확률이 이 값(%) 이하인 생존 결과는 '드문 인과'
  // 전생의 기억: 같은 선택지에서 죽은 횟수당 생존 확률 +perDeath %p (최대 cap). 대박 결과는 횟수당 ×(1+rarePerDeath)
  deathMemory: { perDeath: 2, cap: 10, rarePerDeath: 0.1, rareCap: 0.5 },
  chanceMin: 2,
  chanceMax: 95,
  languages: ["ko"],
  defaultLanguage: "ko",
  langDir: "lang",
  shownStats: ["체력", "근골", "민첩", "내공", "재물"],
  karma: { perScene: 1, perNewOutcome: 2, perAchievement: 5, perRealm: 3, wealthPer: 50, perRare: 5, perSceneMult: 0.02, maxMult: 2 }, // 배율 = 1 + 턴×0.02 (최대 ×2)
  // 업 상점: 산 만큼 매 생 시작할 때 적용. 값 = round(base × growth^현재단계)
  shop: [
    { id: "근골", stat: "근골", amount: 1, base: 20, growth: 1.6, max: 15 },
    { id: "민첩", stat: "민첩", amount: 1, base: 20, growth: 1.6, max: 15 },
    { id: "체력", stat: "체력", amount: 2, base: 15, growth: 1.5, max: 10 },
    { id: "재물", stat: "재물", amount: 10, base: 10, growth: 1.4, max: 10 },
    { id: "내공", stat: "내공", amount: 1, base: 60, growth: 1.8, max: 7 },
  ],
  storage: { meta: "sunheyb.meta.v1", save: "sunheyb.save.v2", settings: "sunheyb.settings.v1" },
  prologueId: "P001", // 매 생의 첫 장면
  // 검은 비늘: 지니고 있으면 weak=true인 죽음(수준 낮은 적의 공격)을 한 번 막아준다
  scaleGuard: { item: "검은_비늘", event: "SYS_SCALE", usedFlag: "비늘이_막음" }, // 한 생에 한 번만
  eventIndex: "data/events/index.json",
  achievementsPath: "data/achievements.json",
};
