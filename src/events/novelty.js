// 새로움 가중치: 인과록(모든 생의 기록)을 보고, 아직 못 본 것이 남은 장면을 더 자주 띄운다.
// 노려볼 만한 것(지금 고를 수 있는 선택지 + 기본 확률 minChance% 이상, 또는 기본 결과)만 센다.
import { meetsCondition } from "./selector.js";

export class NoveltyWeigher {
  constructor(record, config) {
    this.record = record;
    this.cfg = config.novelty;
  }
  // 지금 상태에서 노려볼 만한 결과들 [{ evId, choice, outcome, index }]
  reachable(ev, state) {
    const out = [];
    for (const c of ev.choices) {
      if (!meetsCondition(state, c.condition)) continue;
      c.outcomes.forEach((o, index) => {
        if (o.effects?.death) return;
        if (o.chance != null && o.chance < this.cfg.minChance) return;
        out.push({ choice: c, outcome: o, index });
      });
    }
    return out;
  }
  // 이번 생에 겪은 결과까지 포함해 본 적 있는지
  seenOutcome(state, key) {
    return this.record.data.outcomes.includes(key) || state.outcomesSeen.includes(key);
  }
  weight(ev, state) {
    const rec = this.record;
    if (!rec.knows(`ev:${ev.id}`)) return this.cfg.unseen;
    const reach = this.reachable(ev, state);
    let w = 1;
    if (reach.some((r) => !this.seenOutcome(state, `${ev.id}:c${r.choice.id}.o${r.index}`))) w *= this.cfg.outcome;
    if (reach.some((r) => r.outcome.effects?.achievement && !rec.data.achievements.includes(r.outcome.effects.achievement))) w *= this.cfg.achievement;
    const people = ev.person ? (Array.isArray(ev.person) ? ev.person : [ev.person]) : [];
    const items = reach.flatMap((r) => r.outcome.effects?.items ?? []);
    if (people.some((p) => !rec.knows(`bond:${p}`)) || items.some((x) => !rec.knows(`item:${x}`))) w *= this.cfg.codex;
    return w;
  }
  // 아직 한 번도 골라 본 적 없는 선택지 (모든 생 + 이번 생)
  isFreshChoice(evId, choiceId, state) {
    const p = `${evId}:c${choiceId}.`;
    return !this.record.data.outcomes.some((k) => k.startsWith(p)) && !state.outcomesSeen.some((k) => k.startsWith(p));
  }
}
