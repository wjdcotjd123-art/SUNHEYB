// 조건 판정과 다음 장면 고르기.
// pool 종류: "pool"(기본, 무작위 등장) / "chain"(다른 장면의 next_event로만) / "fixed"(정해진 때에만, 예: 첫 장면)
export function meetsCondition(state, cond = {}) {
  if (cond.items && !cond.items.every((i) => state.hasItem(i))) return false;
  if (cond.items_none && cond.items_none.some((i) => state.hasItem(i))) return false;
  if (cond.flags && !cond.flags.every((f) => state.flags.has(f))) return false;
  if (cond.flags_any && !cond.flags_any.some((f) => state.flags.has(f))) return false;
  if (cond.flags_none && cond.flags_none.some((f) => state.flags.has(f))) return false;
  // flags_count: { of: [플래그…], min, max } — 목록 중 가진 개수가 min~max일 때만
  if (cond.flags_count) {
    const { of, min = 0, max = Infinity } = cond.flags_count;
    const n = of.filter((f) => state.flags.has(f)).length;
    if (n < min || n > max) return false;
  }
  // any: [조건…] 중 하나라도 맞으면 / none_of: [조건…] 중 하나도 안 맞으면
  if (cond.any && !cond.any.some((c) => meetsCondition(state, c))) return false;
  if (cond.none_of && cond.none_of.some((c) => meetsCondition(state, c))) return false;
  if (cond.stat_min && !Object.entries(cond.stat_min).every(([k, v]) => state.stat(k) >= v)) return false;
  if (cond.stat_min_any && !Object.entries(cond.stat_min_any).some(([k, v]) => state.stat(k) >= v)) return false;
  if (cond.realm_min != null && state.stat("경지") < cond.realm_min) return false;
  if (cond.realm_max != null && state.stat("경지") > cond.realm_max) return false;
  // 인연: { 인물: 최소 인연 }
  if (cond.bond_min && !Object.entries(cond.bond_min).every(([k, v]) => (state.bonds?.[k] ?? 0) >= v)) return false;
  // 전생의 인연: { 인물: 지난 생들에서 쌓았던 최고 인연 } — 기시감 선택지
  if (cond.past_bond_min && !Object.entries(cond.past_bond_min).every(([k, v]) => (state.pastBonds?.[k] ?? 0) >= v)) return false;
  // 체질: { 체질id: 최소 단계 } — 켜 둔 체질이 그 단계 이상일 때만
  if (cond.traits && !Object.entries(cond.traits).every(([k, v]) => (state.traits?.[k] ?? 0) >= v)) return false;
  // 소속: "none"이면 무소속일 때만, 이름이면 그 소속일 때만. affiliation_not은 그 소속이면 안 됨.
  const aff = state.affiliation ?? "none";
  if (cond.affiliation && cond.affiliation !== aff) return false;
  if (cond.affiliation_not && cond.affiliation_not.includes(aff)) return false;
  return true;
}

export class EventSelector {
  constructor(eventsById, rng, config) {
    this.events = eventsById;
    this.rng = rng;
    this.config = config;
  }
  // 인과록 기반 새로움 가중치 (NoveltyWeigher)
  useNovelty(weigher) {
    this.novelty = weigher;
  }
  // 정사 치우침 (SideLean)
  useSides(lean) {
    this.sides = lean;
  }
  byId(id) {
    return this.events.get(id) ?? null;
  }
  next(state) {
    // repeat=true인 장면(수련 등)은 여러 번 나올 수 있다. 단, 방금 본 장면은 다른 후보가 있으면 건너뛴다.
    let pool = [...this.events.values()].filter(
      (ev) =>
        (ev.pool ?? "pool") === "pool" &&
        (ev.situation ?? null) === (state.situation ?? null) && // 상황(감옥 등)에 맞는 장면만
        (ev.repeat || !state.seen.has(ev.id)) &&
        meetsCondition(state, ev.conditions)
    );
    // 최근에 본 장면(최대 3개)은 다른 후보가 있으면 건너뛴다.
    const recent = state.recent ?? [state.lastEventId];
    for (let n = recent.length; n > 0; n--) {
      const left = pool.filter((ev) => !recent.slice(-n).includes(ev.id));
      if (left.length) { pool = left; break; }
    }
    if (!pool.length) {
      // 이 경지에서 더 나올 장면이 없으면 경지별 마지막 장면(한 번만)
      const fb = this.byId(this.config.fallbackEvents?.[state.stat("경지")]);
      return fb && !state.seen.has(fb.id) ? fb : null;
    }
    // 내 소속과 같은 group의 장면은 더 자주 나온다.
    const boost = (ev) => (ev.group && ev.group === state.affiliation ? this.config.affiliationBoost : 1) * this.personBoost(ev, state) * (this.sides ? this.sides.weight(ev, state) : 1);
    const fresh = (ev) => (this.novelty ? this.novelty.weight(ev, state) : 1);
    return this.rng.pickWeighted(pool, (ev) => (ev.weight ?? this.config.defaultWeight) * boost(ev) * fresh(ev) * this.chainBoost(ev));
  }
  // 연계의 다음 장면(앞 장면의 플래그나 인연을 조건으로 하는 장면)은 더 자주 나온다. 경지가 오르기 전에 매듭짓도록.
  chainBoost(ev) {
    const c = ev.conditions ?? {};
    const isChain = !ev.repeat && (c.flags?.length || c.flags_any?.length || c.bond_min);
    return isChain ? this.config.chainBoost ?? 1 : 1;
  }
  // 인연을 쌓은 인물이 나오는 장면(person)은 더 자주 나온다: 인연 n당 ×(1 + n/perBond), 최대 maxBond배
  personBoost(ev, state) {
    if (!ev.person) return 1;
    const { perBond, max } = this.config.personBoost;
    const people = Array.isArray(ev.person) ? ev.person : [ev.person];
    const best = Math.max(0, ...people.map((p) => state.bonds?.[p] ?? 0));
    return Math.min(max, 1 + best / perBond);
  }
  // 조건을 채운 선택지. 비추천 표시와 정렬은 main에서 지금 상태로 계산한다.
  availableChoices(ev, state) {
    return ev.choices.filter((c) => meetsCondition(state, c.condition));
  }
}
