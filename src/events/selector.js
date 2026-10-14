// 조건 판정과 다음 장면 고르기.
// pool 종류: "pool"(기본, 무작위 등장) / "chain"(다른 장면의 next_event로만) / "fixed"(정해진 때에만, 예: 첫 장면)
export function meetsCondition(state, cond = {}) {
  if (cond.items && !cond.items.every((i) => state.hasItem(i))) return false;
  if (cond.flags && !cond.flags.every((f) => state.flags.has(f))) return false;
  if (cond.flags_any && !cond.flags_any.some((f) => state.flags.has(f))) return false;
  if (cond.flags_none && cond.flags_none.some((f) => state.flags.has(f))) return false;
  if (cond.stat_min && !Object.entries(cond.stat_min).every(([k, v]) => state.stat(k) >= v)) return false;
  if (cond.stat_min_any && !Object.entries(cond.stat_min_any).some(([k, v]) => state.stat(k) >= v)) return false;
  if (cond.realm_min != null && state.stat("경지") < cond.realm_min) return false;
  if (cond.realm_max != null && state.stat("경지") > cond.realm_max) return false;
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
  byId(id) {
    return this.events.get(id) ?? null;
  }
  next(state) {
    // repeat=true인 장면(수련 등)은 여러 번 나올 수 있다. 단, 방금 본 장면은 다른 후보가 있으면 건너뛴다.
    let pool = [...this.events.values()].filter(
      (ev) => (ev.pool ?? "pool") === "pool" && (ev.repeat || !state.seen.has(ev.id)) && meetsCondition(state, ev.conditions)
    );
    // 최근에 본 장면(최대 3개)은 다른 후보가 있으면 건너뛴다.
    const recent = state.recent ?? [state.lastEventId];
    for (let n = recent.length; n > 0; n--) {
      const left = pool.filter((ev) => !recent.slice(-n).includes(ev.id));
      if (left.length) { pool = left; break; }
    }
    if (!pool.length) return null;
    // 내 소속과 같은 group의 장면은 더 자주 나온다.
    const boost = (ev) => (ev.group && ev.group === state.affiliation ? this.config.affiliationBoost : 1);
    return this.rng.pickWeighted(pool, (ev) => (ev.weight ?? this.config.defaultWeight) * boost(ev));
  }
  // 비추천(warn) 선택지는 항상 맨 뒤로 보낸다.
  availableChoices(ev, state) {
    const ok = ev.choices.filter((c) => meetsCondition(state, c.condition));
    return [...ok.filter((c) => !c.warn), ...ok.filter((c) => c.warn)];
  }
}
