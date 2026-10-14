// 회차(몇 번째 생)와 업(業), 인과록, 전생의 죽음 기록, 업 상점 단계.
import { Store } from "../core/store.js";

const empty = () => ({ life: 0, karma: 0, karmaEarned: 0, outcomes: [], achievements: [], deaths: {}, shop: {} });

export class LifeRecord {
  constructor(config) {
    this.config = config;
    const saved = Store.get(config.storage.meta, {});
    this.data = { ...empty(), ...saved };
    // 예전 기록에는 누적 업이 없으므로 남은 업으로 채운다.
    if (saved.karmaEarned == null) this.data.karmaEarned = this.data.karma;
  }
  save() {
    Store.set(this.config.storage.meta, this.data);
  }
  wipe() {
    this.data = empty();
    Store.remove(this.config.storage.meta);
  }
  startLife() {
    this.data.life += 1;
    this.save();
    return this.data.life;
  }
  // 전생의 기억: 어떤 선택지에서 몇 번 죽었는지
  deathsAt(evId, choiceId) {
    return this.data.deaths[`${evId}:${choiceId}`] ?? 0;
  }
  recordDeath(evId, choiceId) {
    const k = `${evId}:${choiceId}`;
    this.data.deaths[k] = (this.data.deaths[k] ?? 0) + 1;
    this.save();
  }
  spend(amount) {
    if (this.data.karma < amount) return false;
    this.data.karma -= amount;
    this.save();
    return true;
  }
  // 한 생이 끝날 때 업을 계산해 쌓는다.
  endLife(state) {
    const k = this.config.karma;
    const known = new Set(this.data.outcomes);
    const fresh = [...new Set(state.outcomesSeen)].filter((o) => !known.has(o));
    const newAch = [...new Set(state.achievements)].filter((a) => !this.data.achievements.includes(a));
    const parts = [
      { id: "scenes", value: state.scenes * k.perScene },
      { id: "fresh", value: fresh.length * k.perNewOutcome },
      { id: "realm", value: state.stat("경지") * k.perRealm },
      { id: "achievements", value: newAch.length * k.perAchievement },
      { id: "wealth", value: Math.max(0, Math.floor(state.stat("재물") / k.wealthPer)), note: state.stat("재물") },
      { id: "rare", value: (state.rare ?? 0) * k.perRare },
    ];
    const total = parts.reduce((s, p) => s + p.value, 0);
    this.data.outcomes.push(...fresh);
    this.data.achievements.push(...newAch);
    this.data.karma += total;
    this.data.karmaEarned += total;
    this.save();
    return { parts, total, newAch };
  }
}
