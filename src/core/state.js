// 한 번의 생(生) 동안의 주인공 상태.
export class GameState {
  static weapons = {};
  constructor(config) {
    if (config.weapons) GameState.weapons = config.weapons;
    this.stats = { ...config.startStats };
    this.items = [...config.startItems];
    this.flags = new Set();
    this.bonds = {};
    this.reputation = {};
    this.affiliation = null;
    this.situation = null; // 지금 처한 상황(예: "수감"). 있으면 그 상황의 장면만 나온다
    this.path = null; // 이야기 갈래(예: "이어진_길"). 화면에는 보이지 않고, 그 갈래의 장면만 나온다
    this.seen = new Set();
    this.outcomesSeen = [];
    this.achievements = [];
    this.scenes = 0;
    this.lastEventId = null;
    this.recent = []; // 최근 본 장면 3개
    this.termCounts = {}; // 이번 생에 용어 밑줄이 나온 횟수
    this.stagnant = 0; // 벽을 넘을 준비가 된 뒤 머문 장면 수
    this.rare = 0; // 이번 생에 터진 드문 인과 수
    this.log = []; // 하단 기록창 내용 {title, tag, changes, dead}
    this.dead = false;
    this.ending = null; // 귀결(이야기가 매듭지어진 결말) id
    this.pastBonds = {}; // 지난 생들의 최고 인연 (기시감)
  }
  // 능력치(가진 무기의 보너스 포함). base()는 무기를 뺀 원래 값.
  stat(name) {
    return this.base(name) + (this.gear()[name] ?? 0);
  }
  base(name) {
    return this.stats[name] ?? 0;
  }
  // 가진 무기 중 보너스 합이 가장 큰 한 자루만 쓴다.
  weapon() {
    let best = null, top = 0;
    for (const it of this.items) {
      const b = GameState.weapons[it];
      const sum = b ? Object.values(b).reduce((a, v) => a + v, 0) : 0;
      if (sum > top) { best = it; top = sum; }
    }
    return best;
  }
  gear() {
    const w = this.weapon();
    return w ? GameState.weapons[w] : {};
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
