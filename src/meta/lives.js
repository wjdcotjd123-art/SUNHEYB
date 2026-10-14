// 회차(몇 번째 생)와 업(業) 기록. 브라우저에 저장하되, 저장이 막혀도 게임은 돌아간다.
export class LifeRecord {
  constructor(config) {
    this.config = config;
    this.data = { life: 0, karma: 0, outcomes: [], achievements: [] };
    try {
      const raw = localStorage.getItem(config.storageKey);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch (_) {}
  }
  save() {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.data));
    } catch (_) {}
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
      { label: "걸어온 길", value: state.scenes * k.perScene },
      { label: "처음 겪은 인과", value: fresh.length * k.perNewOutcome },
      { label: "도달한 경지", value: state.stat("경지") * k.perRealm },
      { label: "새로 새긴 인과록", value: newAch.length * k.perAchievement },
    ];
    const total = parts.reduce((s, p) => s + p.value, 0);
    this.data.outcomes.push(...fresh);
    this.data.achievements.push(...newAch);
    this.data.karma += total;
    this.save();
    return { parts, total, newAch };
  }
}
