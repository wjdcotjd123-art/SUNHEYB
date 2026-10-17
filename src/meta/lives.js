// 회차(몇 번째 생)와 업(業), 인과록, 전생의 죽음 기록, 업 상점 단계.
import { Store } from "../core/store.js";

const empty = () => ({ life: 0, karma: 0, karmaEarned: 0, outcomes: [], achievements: [], deaths: {}, shop: {}, traits: {}, known: [], bondsMax: {}, endings: [], memories: {}, memoriesSeen: [] });

export class LifeRecord {
  constructor(config) {
    this.config = config;
    const saved = Store.get(config.storage.meta, {});
    this.data = { ...empty(), ...saved };
    // 예전 기록에는 누적 업이 없으므로 남은 업으로 채운다.
    if (saved.karmaEarned == null) this.data.karmaEarned = this.data.karma;
    // 예전 기록의 인과록(업적)도 도감 지식으로 옮겨 둔다.
    this.data.known = [...new Set([...this.data.known, ...this.data.achievements.map((a) => `ach:${a}`)])];
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
  // 인과록 도감용: 모든 생을 통틀어 겪은 것(ev:/flag:/item:/ach:/bond:/aff:)
  learn(keys) {
    const set = new Set(this.data.known);
    const before = set.size;
    keys.forEach((k) => set.add(k));
    if (set.size !== before) { this.data.known = [...set]; this.save(); }
  }
  knows(key) {
    return this.data.known.includes(key);
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
  // 시험용: 업을 그냥 넣어 준다
  grant(amount) {
    this.data.karma += amount;
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
      { id: "ending", value: state.ending && !(k.noEndingBonus ?? []).includes(state.ending) ? k.perEnding : 0 },
    ];
    // 오래 버틸수록 배율이 붙는다: 1 + 턴 수 × perSceneMult (최대 maxMult)
    const base = parts.reduce((s, p) => s + p.value, 0);
    const mult = Math.min(k.maxMult, 1 + state.scenes * k.perSceneMult);
    const total = Math.round(base * mult);
    // 기시감용: 인물마다 지난 생들의 최고 인연
    for (const [who, v] of Object.entries(state.bonds)) this.data.bondsMax[who] = Math.max(this.data.bondsMax[who] ?? 0, v);
    // 처음 본 귀결이 기억을 연다면 정산 화면에서 알린다
    const newMemories = state.ending && !this.data.endings.includes(state.ending)
      ? (this.config.memories ?? []).filter((m) => m.unlock === state.ending).map((m) => m.id) : [];
    if (state.ending && !this.data.endings.includes(state.ending)) this.data.endings.push(state.ending);
    this.data.outcomes.push(...fresh);
    this.data.achievements.push(...newAch);
    this.data.karma += total;
    this.data.karmaEarned += total;
    this.save();
    return { parts, base, mult, total, newAch, newMemories };
  }
}
