// 데이터 읽기. 이벤트 묶음 목록은 data/events/index.json에 있다.
// 단일 파일로 빌드된 판에서는 window.EVENT_DATA / window.ACHIEVEMENT_DATA를 그대로 쓴다.
export class EventLoader {
  constructor(indexPath, achievementsPath) {
    this.indexPath = indexPath;
    this.achievementsPath = achievementsPath;
  }
  async load() {
    if (window.EVENT_DATA) return this.merge(window.EVENT_DATA);
    const base = this.indexPath.slice(0, this.indexPath.lastIndexOf("/") + 1);
    const index = await (await fetch(this.indexPath)).json();
    const batches = await Promise.all(index.batches.map(async (f) => (await fetch(base + f)).json()));
    return this.merge(batches);
  }
  async loadAchievements() {
    const data = window.ACHIEVEMENT_DATA ?? (await (await fetch(this.achievementsPath)).json());
    return data.achievements;
  }
  merge(batches) {
    const byId = new Map();
    for (const b of batches) for (const ev of b.events) byId.set(ev.id, ev);
    return byId;
  }
}
