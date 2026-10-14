// 한 번의 생(生) 동안의 주인공 상태.
export class GameState {
  constructor(config) {
    this.stats = { ...config.startStats };
    this.items = [...config.startItems];
    this.flags = new Set();
    this.bonds = {};
    this.reputation = {};
    this.affiliation = null;
    this.seen = new Set();
    this.outcomesSeen = [];
    this.achievements = [];
    this.scenes = 0;
    this.lastEventId = null;
    this.log = []; // 하단 기록창 내용 {title, tag, changes, dead}
    this.dead = false;
  }
  stat(name) {
    return this.stats[name] ?? 0;
  }
  hasItem(name) {
    return this.items.includes(name);
  }
  addItem(name) {
    this.items.push(name);
  }
  removeItem(name) {
    const i = this.items.indexOf(name);
    if (i >= 0) this.items.splice(i, 1);
  }
}
