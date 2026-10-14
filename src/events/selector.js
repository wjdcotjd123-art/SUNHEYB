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
    const pool = [...this.events.values()].filter(
      (ev) => (ev.pool ?? "pool") === "pool" && !state.seen.has(ev.id) && meetsCondition(state, ev.conditions)
    );
    if (!pool.length) return null;
    return this.rng.pickWeighted(pool, (ev) => ev.weight ?? this.config.defaultWeight);
  }
  availableChoices(ev, state) {
    return ev.choices.filter((c) => meetsCondition(state, c.condition));
  }
}
