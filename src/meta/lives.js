// 회차(몇 번째 생)와 업(業), 인과록 기록.
import { Store } from "../core/store.js";

const EMPTY = { life: 0, karma: 0, outcomes: [], achievements: [] };

export class LifeRecord {
  constructor(config) {
    this.config = config;
    this.data = { ...EMPTY, ...Store.get(config.storage.meta, {}) };
  }
  save() {
    Store.set(this.config.storage.meta, this.data);
  }
  wipe() {
    this.data = { ...EMPTY, outcomes: [], achievements: [] };
    Store.remove(this.config.storage.meta);
  }
  startLife() {
    this.data.life += 1;
    this.save();
    return this.data.life;
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
    ];
    const total = parts.reduce((s, p) => s + p.value, 0);
    this.data.outcomes.push(...fresh);
    this.data.achievements.push(...newAch);
    this.data.karma += total;
    this.save();
    return { parts, total, newAch };
  }
}
