// 한 번의 생(生) 동안의 주인공 상태.
export class GameState {
  constructor(config) {
    this.stats = { ...config.startStats };
    this.items = [...config.startItems];
    this.flags = new Set();
    this.bonds = {};
    this.reputation = {};
    this.affiliation = null;
    this.situation = null; // 지금 처한 상황(예: "수감"). 있으면 그 상황의 장면만 나온다
    this.seen = new Set();
    this.outcomesSeen = [];
    this.achievements = [];
    this.scenes = 0;
    this.lastEventId = null;
    this.recent = []; // 최근 본 장면 3개
    this.termCounts = {}; // 이번 생에 용어 밑줄이 나온 횟수
    this.rare = 0; // 이번 생에 터진 드문 인과 수
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
