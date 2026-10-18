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
    if (outcome.effects?.realm_set) c += this.breakBonus(state);
    // flagMods: { 플래그: %p } — 그 플래그가 있으면 확률을 더한다 (예: 결전에서 모인 조력)
    for (const [f, per] of Object.entries(outcome.flagMods ?? {})) if (state.flags.has(f)) c += per;
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
    const m = { ...this.config.deathMemory, ...(choice.memory ?? {}) }; // 선택지마다 전생의 기억 보정을 키울 수 있다
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

  // pick과 같은 규칙으로 각 결과가 나올 확률(%)을 [결과, 확률] 목록으로 돌려준다.
  distribution(choice, state, deaths = 0) {
    if (choice.noDeathIf && meetsCondition(state, choice.noDeathIf)) {
      const alive = choice.outcomes.filter((o) => !o.effects?.death);
      const last = alive[alive.length - 1];
      choice = { ...choice, outcomes: alive.map((o) => (o === last ? { ...o, chance: undefined, src: o.src ?? o } : o)) };
    }
    const m = { ...this.config.deathMemory, ...(choice.memory ?? {}) }; // 선택지마다 전생의 기억 보정을 키울 수 있다
    const bonus = Math.min(m.cap, deaths * m.perDeath);
    const outs = choice.outcomes;
    const fallback = outs.find((o) => o.chance == null) ?? outs[outs.length - 1];
    const fallbackDeath = !!outs.find((o) => o.chance == null)?.effects?.death;
    let boosted = false;
    let acc = 0;
    const list = [];
    for (const o of outs) {
      if (o.chance == null) continue;
      let c = this.chanceOf(o, state);
      if (bonus) {
        if (o.effects?.death) c = Math.max(0, c - bonus);
        else if (this.isRare(o)) c *= 1 + Math.min(m.rareCap, deaths * m.rarePerDeath);
        else if (fallbackDeath && !boosted) { c += bonus; boosted = true; }
      }
      list.push([o, Math.max(0, Math.min(acc + c, 100) - Math.min(acc, 100))]);
      acc += c;
    }
    list.push([fallback, Math.max(0, 100 - acc)]);
    return list;
  }

  stalled(stat, state) {
    const st = this.config.stagnation;
    return !!st && (state.stagnant ?? 0) >= st.limit && st.stats.includes(stat) && state.stat("경지") in st.walls;
  }

  // 켜 둔 체질이 경지 돌파 결과에 더해 주는 확률(%p)
  breakBonus(state) {
    let b = 0;
    for (const tr of this.config.traits ?? []) {
      const lv = state.traits?.[tr.id];
      if (lv) b += tr.tiers[lv - 1]?.breakBonus ?? 0;
    }
    return b;
  }

  // 켜 둔 체질이 이 능력치를 얻을 때 더 주는 양 { n, name } (없으면 null)
  gainBonus(stat, state) {
    for (const tr of this.config.traits ?? []) {
      const lv = state.traits?.[tr.id];
      const n = lv ? tr.tiers[lv - 1]?.bonus?.[stat] : 0;
      if (n) return { n, name: tr.tiers[lv - 1].name };
    }
    return null;
  }

  // 이 결과가 지금 상태에서 목숨을 앗아가는지 (죽음, 또는 체력이 바닥나는 피해)
  kills(outcome, state) {
    const e = outcome.effects ?? {};
    if (e.death) return true;
    if (e.피해) {
      const amt = Math.max(1, Math.ceil(state.stat("최대체력") * this.config.hpTiers.피해[e.피해]));
      return state.stat("체력") - amt <= 0;
    }
    return false;
  }

  // 효과를 적용하고, 화면에 보여줄 변화 목록(언어와 무관한 구조)을 돌려준다.
  apply(outcome, state) {
    const changes = [];
    const e = outcome.effects ?? {};
    for (const [k, v] of Object.entries(e)) {
      // 없앤 능력치(체력 등)는 적용하지 않는다
      if (this.config.disabledStats?.includes(k.replace(/_set$/, ""))) continue;
      if (k === "death") state.dead = !!v;
      else if (k === "items") v.forEach((i) => { state.addItem(i); changes.push({ type: "gain", item: i, good: true }); });
      else if (k === "items_remove") v.forEach((i) => { state.removeItem(i); changes.push({ type: "lose", item: i, good: false }); });
      else if (k === "items_clear") { if (state.items.length) changes.push({ type: "loseAll", good: false }); state.items = []; }
      else if (k === "flags") v.forEach((f) => state.flags.add(f));
      else if (k === "flags_remove") v.forEach((f) => state.flags.delete(f));
      else if (k === "achievement") state.achievements.push(v);
      else if (k === "next_event" || k === "전투") continue;
      // if: [{ when: {조건}, effects: {…} }] — 조건을 채울 때만 더 적용 (예: 지난 생 기억이 있으면 단서)
      else if (k === "if") v.forEach((c) => { if (meetsCondition(state, c.when)) changes.push(...this.apply({ effects: c.effects }, state)); });
      else if (k === "ending") state.ending = v;
      // 전투 기세 같은 임시 수치를 조용히 0으로 (예: "기세_reset": true)
      // 체력 회복·피해: 단계(조금/제법/완전, 가볍게/크게/치명)를 최대 체력 비율로
      else if (k === "회복" || k === "피해") {
        const max = state.stat("최대체력");
        const amt = Math.max(1, Math.ceil(max * this.config.hpTiers[k][v]));
        state.stats.체력 = k === "회복" ? Math.min(max, state.stat("체력") + amt) : state.stat("체력") - amt;
        changes.push({ type: "hp", kind: k, tier: v, good: k === "회복" });
      }
      else if (k.endsWith("_reset")) state.stats[k.slice(0, -6)] = 0;
      else if (k === "realm_set") { if (v > state.stat("경지")) state.stats.체력 = state.stat("최대체력"); state.stats.경지 = v; state.stagnant = 0; changes.push({ type: "realm", value: v, good: true }); }
      else if (k.endsWith("_set")) { const s = k.slice(0, -4); state.stats[s] = v; changes.push({ type: "set", stat: s, value: v, good: false }); }
      else if (k === "갈래") state.path = v === "없음" ? null : v; // 숨은 이야기 갈래(화면에 표시하지 않음)
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
      else if (typeof v === "number" && v > 0 && this.stalled(k, state)) {
        // 벽 앞에서 너무 오래 머물렀다: 이 경지에서는 더 오르지 않는다
        if (!changes.some((c) => c.type === "stall")) changes.push({ type: "stall", good: false });
      }
      else if (typeof v === "number") {
        const extra = v > 0 ? this.gainBonus(k, state) : null; // 예: 삼재지체는 내공을 얻을 때마다 1 더
        state.stats[k] = state.base(k) + v + (extra?.n ?? 0);
        if (k === "재물" && state.stats[k] < 0) state.stats[k] = 0; // 재물은 있는 만큼만 잃는다
        changes.push({ type: "stat", stat: k, delta: v, extra, good: v > 0 });
      }
    }
    if (state.stat("체력") <= 0) state.dead = true;
    return changes;
  }
}

function addAll(target, deltas) {
  for (const [k, d] of Object.entries(deltas)) target[k] = (target[k] ?? 0) + d;
}

