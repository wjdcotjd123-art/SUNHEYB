// 선택 결과 판정(확률 + 스탯 보정)과 효과 적용.
export class ResultResolver {
  constructor(rng, config) {
    this.rng = rng;
    this.config = config;
  }

  chanceOf(outcome, state) {
    let c = outcome.chance;
    for (const [stat, per] of Object.entries(outcome.mods ?? {})) c += per * state.stat(stat);
    return Math.min(this.config.chanceMax, Math.max(this.config.chanceMin, c));
  }

  // chance가 있는 결과들을 차례로 쌓고, 남은 확률은 chance 없는 결과가 가져간다.
  pick(choice, state) {
    const r = this.rng.percent();
    let acc = 0;
    let fallback = null;
    for (const o of choice.outcomes) {
      if (o.chance == null) {
        fallback = fallback ?? o;
        continue;
      }
      acc += this.chanceOf(o, state);
      if (r < acc) return o;
    }
    return fallback ?? choice.outcomes[choice.outcomes.length - 1];
  }

  // 효과를 적용하고, 화면에 보여줄 변화 목록(언어와 무관한 구조)을 돌려준다.
  apply(outcome, state) {
    const changes = [];
    const e = outcome.effects ?? {};
    for (const [k, v] of Object.entries(e)) {
      if (k === "death") state.dead = !!v;
      else if (k === "items") v.forEach((i) => { state.addItem(i); changes.push({ type: "gain", item: i, good: true }); });
      else if (k === "items_remove") v.forEach((i) => { state.removeItem(i); changes.push({ type: "lose", item: i, good: false }); });
      else if (k === "items_clear") { if (state.items.length) changes.push({ type: "loseAll", good: false }); state.items = []; }
      else if (k === "flags") v.forEach((f) => state.flags.add(f));
      else if (k === "flags_remove") v.forEach((f) => state.flags.delete(f));
      else if (k === "achievement") state.achievements.push(v);
      else if (k === "next_event") continue;
      else if (k === "realm_set") { state.stats.경지 = v; changes.push({ type: "realm", value: v, good: true }); }
      else if (k.endsWith("_set")) { const s = k.slice(0, -4); state.stats[s] = v; changes.push({ type: "set", stat: s, value: v, good: false }); }
      else if (k === "소속") { state.affiliation = v; changes.push({ type: "join", name: v, good: true }); }
      else if (k === "인연") { addAll(state.bonds, v); for (const [who, d] of Object.entries(v)) changes.push({ type: "bond", name: who, delta: d, good: d > 0 }); }
      else if (k === "평판") { addAll(state.reputation, v); for (const [who, d] of Object.entries(v)) changes.push({ type: "fame", name: who, delta: d, good: d > 0 }); }
      else if (typeof v === "number") {
        state.stats[k] = state.stat(k) + v;
        changes.push({ type: "stat", stat: k, delta: v, good: v > 0 });
      }
    }
    if (state.stat("체력") <= 0) state.dead = true;
    return changes;
  }
}

function addAll(target, deltas) {
  for (const [k, d] of Object.entries(deltas)) target[k] = (target[k] ?? 0) + d;
}

