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

  // 효과를 적용하고, 화면에 보여줄 변화 목록을 돌려준다.
  apply(outcome, state) {
    const changes = [];
    const e = outcome.effects ?? {};
    for (const [k, v] of Object.entries(e)) {
      if (k === "death") state.dead = !!v;
      else if (k === "items") v.forEach((i) => { state.addItem(i); changes.push({ text: `${nice(i)} 획득`, good: true }); });
      else if (k === "items_remove") v.forEach((i) => { state.removeItem(i); changes.push({ text: `${nice(i)} 잃음`, good: false }); });
      else if (k === "items_clear") { if (state.items.length) changes.push({ text: "소지품 전부 잃음", good: false }); state.items = []; }
      else if (k === "flags") v.forEach((f) => state.flags.add(f));
      else if (k === "flags_remove") v.forEach((f) => state.flags.delete(f));
      else if (k === "achievement") state.achievements.push(v);
      else if (k === "next_event") continue;
      else if (k === "realm_set") { state.stats.경지 = v; changes.push({ text: `경지 · ${this.config.realmNames[v]}`, good: true }); }
      else if (k.endsWith("_set")) { const s = k.slice(0, -4); state.stats[s] = v; changes.push({ text: `${s} ${v}`, good: false }); }
      else if (k === "소속") state.affiliation = v;
      else if (k === "인연") addAll(state.bonds, v);
      else if (k === "평판") addAll(state.reputation, v);
      else if (typeof v === "number") {
        state.stats[k] = state.stat(k) + v;
        changes.push({ text: `${k} ${v > 0 ? "+" : ""}${v}`, good: v > 0 });
      }
    }
    if (state.stat("체력") <= 0) state.dead = true;
    return changes;
  }
}

function addAll(target, deltas) {
  for (const [k, d] of Object.entries(deltas)) target[k] = (target[k] ?? 0) + d;
}

export function nice(id) {
  return id.replaceAll("_", " ");
}
