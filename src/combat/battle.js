// 전투 엔진: 화면과 상관없이 합(合) 단위로 계산만 한다.
// 근골 = 피해량, 민첩 = 명중·회피(선공도 민첩), 행운 = 치명타·회피 보정, 내공 = 무공 위력(쓸 때 소모, 끝나면 복구)
export class Battle {
  constructor(rng, config, player, enemy, arts) {
    this.rng = rng;
    this.cfg = config.combat;
    this.player = player; // GameState
    this.enemy = { ...enemy, hp: enemy.체력, max: enemy.체력 };
    this.arts = arts; // 지금 쓸 수 있는 무공
    this.neigongStart = player.stat("내공");
    this.round = 0;
    this.over = null; // "win" | "lose"
    // 민첩이 높은 쪽이 먼저 친다 (같으면 나)
    this.playerFirst = player.stat("민첩") >= enemy.민첩;
  }
  // 공격자 능력치 묶음
  me() {
    const s = this.player;
    return { 근골: s.stat("근골"), 민첩: s.stat("민첩"), 행운: s.stat("행운"), realm: s.stat("경지") };
  }
  hitChance(att, def) {
    const c = this.cfg;
    const v = c.baseHit + (att.민첩 - def.민첩) * c.perAgi - def.행운 * c.perLuckEvade + (att.realm - def.realm) * c.perRealmHit;
    return Math.max(c.minHit, Math.min(c.maxHit, v));
  }
  damage(att, def, mult = 1) {
    const c = this.cfg;
    const base = 1 + att.근골 * c.perStr + Math.max(0, att.realm - def.realm) * c.perRealmDmg;
    const spread = 0.85 + this.rng.next() * 0.3;
    return Math.max(1, Math.round(base * mult * spread));
  }
  // 한 번의 공격. 결과 { who, hit, crit, dmg, art }
  strike(who, art = null, guarded = false) {
    const att = who === "me" ? this.me() : this.enemy;
    const def = who === "me" ? this.enemy : this.me();
    const res = { who, art: art?.id ?? null, hit: false, crit: false, dmg: 0 };
    if (this.rng.percent() >= this.hitChance(att, def)) return res;
    res.hit = true;
    let mult = 1;
    if (art) mult = art.power + this.player.stat("내공") * art.perNeigong * 0.1;
    if (this.rng.percent() < this.cfg.baseCrit + att.행운 * this.cfg.perLuckCrit) { res.crit = true; mult *= 2; }
    let dmg = this.damage(att, def, mult);
    if (guarded) dmg = Math.max(0, Math.round(dmg * (1 - this.cfg.guard)));
    res.dmg = dmg;
    if (who === "me") this.enemy.hp -= dmg;
    else this.player.stats.체력 = this.player.stat("체력") - dmg;
    return res;
  }
  // 한 합: action = { type: "attack" | "art" | "guard", art }
  turn(action) {
    this.round += 1;
    const log = [];
    const art = action.type === "art" ? action.art : null;
    if (art) this.player.stats.내공 = this.player.stat("내공") - art.cost;
    const guard = action.type === "guard";
    const mine = () => { if (!guard) log.push(this.strike("me", art)); };
    const theirs = () => { log.push(this.strike("enemy", null, guard)); };
    const order = this.playerFirst ? [mine, theirs] : [theirs, mine];
    for (const step of order) {
      step();
      if (this.enemy.hp <= 0) { this.over = "win"; break; }
      if (this.player.stat("체력") <= 0) { this.over = "lose"; break; }
    }
    return log;
  }
  // 쓸 수 있는 무공 (내공이 모자라면 못 씀)
  usableArts() {
    return this.arts.map((a) => ({ ...a, ok: this.player.stat("내공") >= a.cost }));
  }
  // 전투가 끝나면 내공은 원래대로
  finish() {
    this.player.stats.내공 = this.neigongStart;
  }
}
