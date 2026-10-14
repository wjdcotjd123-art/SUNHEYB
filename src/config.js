// 게임 전체 설정값. 숫자는 여기서만 바꾼다.
export const CONFIG = {
  startStats: { 체력: 10, 근골: 3, 민첩: 3, 재물: 0, 내공: 0, 경지: 0 },
  startItems: ["라이터"],
  defaultWeight: 5,
  affiliationBoost: 4, // 소속과 같은 group 장면의 등장 가중치 배수
  chanceMin: 2,
  chanceMax: 95,
  languages: ["ko"],
  defaultLanguage: "ko",
  langDir: "lang",
  shownStats: ["체력", "근골", "민첩", "내공", "재물"],
  karma: { perScene: 1, perNewOutcome: 2, perAchievement: 5, perRealm: 3 },
  storage: { meta: "sunheyb.meta.v1", save: "sunheyb.save.v2", settings: "sunheyb.settings.v1" },
  prologueId: "P001", // 매 생의 첫 장면
  eventIndex: "data/events/index.json",
  achievementsPath: "data/achievements.json",
};
