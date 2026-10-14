// 선택 결과 판정(확률 + 스탯 보정)과 효과 적용.
import { meetsCondition } from "./selector.js";
export class ResultResolver {
  constructor(rng, config) {
    this.rng = rng;
    this.config = config;
  }

  chanceOf(outcome, state) {
    let c = outcome.chance;
    for (const [stat, per] of Object.entries(outcome.mods ?? {})) c += per * state.stat(stat);
    // 하한은 chanceMin이지만, 원래부터 그보다 낮게 잡은 극악 확률은 그대로 둔다.
    return Math.min(this.config.chanceMax, Math.max(Math.min(this.config.chanceMin, outcome.chance), c));
  }

  // 드문 인과: 기본 확률이 rareChance 이하이면서 죽음이 아닌 결과.
  isRare(outcome) {
    return outcome.chance != null && outcome.chance <= this.config.rareChance && !outcome.effects?.death;
  }

  // chance가 있는 결과들을 차례로 쌓고, 남은 확률은 chance 없는 결과가 가져간다.
  // deaths: 전생에 이 선택지에서 죽은 횟수. 죽음 확률을 조금 깎아준다(전생의 기억).
  //  - 죽음 결과에 chance가 있으면 그만큼 빼고,
  //  - 죽음이 나머지 확률이면 처음 나오는 평범한 생존 결과에 더한다.
  //  - 드문 인과(대박)는 배율로만 조금 올려서 대박의 희소함은 지킨다.
  pick(choice, state, deaths = 0) {
    // noDeathIf: 이 조건을 채우면 이 선택지에서는 죽지 않는다 (남은 확률은 마지막 생존 결과가 가져감)
    if (choice.noDeathIf && meetsCondition(state, choice.noDeathIf)) {
      const alive = choice.outcomes.filter((o) => !o.effects?.death);
      const last = alive[alive.length - 1];
      choice = { ...choice, outcomes: alive.map((o) => (o === last ? { ...o, chance: undefined } : o)) };
    }
    const m = this.config.deathMemory;
    const bonus = Math.min(m.cap, deaths * m.perDeath);
    const outs = choice.outcomes;
    const fallback = outs.find((o) => o.chance == null) ?? null;
    const fallbackDeath = !!fallback?.effects?.death;
    let boosted = false;
    const r = this.rng.percent();
    let acc = 0;
    for (const o of outs) {
      if (o.chance == null) continue;
      let c = this.chanceOf(o, state);
      if (bonus) {
        if (o.effects?.death) c = Math.max(0, c - bonus);
        else if (this.isRare(o)) c *= 1 + Math.min(m.rareCap, deaths * m.rarePerDeath);
        else if (fallbackDeath && !boosted) { c += bonus; boosted = true; }
      }
      acc += c;
      if (r < acc) return o;
    }
    return fallback ?? outs[outs.length - 1];
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
      else if (k === "상황") {
        // 상황 "없음"은 상황에서 벗어난다 (예: 감옥에서 풀려남)
        state.situation = v === "없음" ? null : v;
        changes.push({ type: "situation", name: v, good: v === "없음" });
      }
      else if (k === "소속") {
        // 소속 "없음"은 무소속으로 되돌린다.
        state.affiliation = v === "없음" ? null : v;
        changes.push(v === "없음" ? { type: "leave", good: false } : { type: "join", name: v, good: true });
      }
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

