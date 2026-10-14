// 게임 전체 설정값. 숫자는 여기서만 바꾼다.
export const CONFIG = {
  startStats: { 체력: 10, 근골: 3, 민첩: 3, 은자: 0, 내공: 0, 경지: 0 },
  startItems: ["라이터"],
  defaultWeight: 5,
  chanceMin: 2,
  chanceMax: 95,
  realmNames: ["범인", "삼류", "이류", "일류", "절정", "초절정", "화경", "현경"],
  shownStats: ["체력", "근골", "민첩", "내공", "은자"],
  karma: { perScene: 1, perNewOutcome: 2, perAchievement: 5, perRealm: 3 },
  storageKey: "sunheyb.meta.v1",
  eventIndex: "data/events/index.json",
};
