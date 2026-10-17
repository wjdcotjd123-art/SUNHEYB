// 정사 치우침: 내가 정파·사파 중 한쪽으로 크게 기울면, 반대쪽 인물의 장면이 덜 나온다.
// 기울었다고 보는 때: 평판 차이가 repGap 이상 / 그쪽 인물과 인연이 bond 이상 / 그쪽 편을 골랐을 때(sideFlags)
export class SideLean {
  constructor(config) {
    this.cfg = config.sides;
  }
  // 지금 기운 쪽("정파" | "사파" | null)
  lean(state) {
    const c = this.cfg;
    if (!c) return null;
    const score = {};
    for (const side of Object.keys(c.people)) {
      const other = Object.keys(c.people).find((s) => s !== side);
      const rep = (state.reputation?.[side] ?? 0) - (state.reputation?.[other] ?? 0);
      const bond = Math.max(0, ...c.people[side].map((p) => state.bonds?.[p] ?? 0));
      score[side] = (rep >= c.repGap ? 1 : 0) + (bond >= c.bond ? 1 : 0) + (state.flags.has(c.sideFlags[side]) ? 1 : 0);
    }
    const [a, b] = Object.keys(score);
    if (score[a] === score[b]) return null;
    return score[a] > score[b] ? a : b;
  }
  sideOf(person) {
    for (const [side, list] of Object.entries(this.cfg?.people ?? {})) if (list.includes(person)) return side;
    return null;
  }
  // 장면 가중치 배수
  weight(ev, state) {
    if (!ev.person || !this.cfg) return 1;
    const lean = this.lean(state);
    if (!lean) return 1;
    const people = Array.isArray(ev.person) ? ev.person : [ev.person];
    const opposite = people.some((p) => { const s = this.sideOf(p); return s && s !== lean; });
    return opposite ? this.cfg.factor : 1;
  }
}
