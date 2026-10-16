// 업 상점: 업을 써서 타고난 바탕을 올린다. 산 단계는 매 생 시작할 때 적용된다.
export class KarmaShop {
  constructor(config, record) {
    this.items = config.shop;
    this.traits = config.traits ?? [];
    this.record = record;
  }
  level(id) {
    return this.record.data.shop[id] ?? 0;
  }
  price(id) {
    const it = this.items.find((x) => x.id === id);
    return Math.round(it.base * Math.pow(it.growth, this.level(id)));
  }
  isMax(id) {
    const it = this.items.find((x) => x.id === id);
    return this.level(id) >= it.max;
  }
  buy(id) {
    if (this.isMax(id) || !this.record.spend(this.price(id))) return false;
    this.record.data.shop[id] = this.level(id) + 1;
    this.record.save();
    return true;
  }
  // 새 생의 상태에 산 만큼 더해준다.
  apply(state) {
    for (const it of this.items) state.stats[it.stat] = state.base(it.stat) + it.amount * this.level(it.id);
  }
  // 체질: record.data.traits[id] = { lv: 산 단계(1부터), on: 켜짐 }
  traitData(id) {
    const v = this.record.data.traits[id];
    if (v == null) return { lv: 0, on: false };
    return typeof v === "boolean" ? { lv: 1, on: v } : v; // 예전 기록(참/거짓) 호환
  }
  traitLevel(id) {
    return this.traitData(id).lv;
  }
  traitOn(id) {
    const d = this.traitData(id);
    return d.lv > 0 && d.on;
  }
  // 지금 단계(안 샀으면 첫 단계)와 다음 단계
  tierOf(tr) {
    return tr.tiers[Math.max(0, this.traitLevel(tr.id) - 1)];
  }
  nextTier(tr) {
    return tr.tiers[this.traitLevel(tr.id)] ?? null;
  }
  buyTrait(id) {
    const tr = this.traits.find((x) => x.id === id);
    const next = tr && this.nextTier(tr);
    if (!next || !this.record.spend(next.price)) return false;
    this.record.data.traits[id] = { lv: this.traitLevel(id) + 1, on: true };
    this.record.save();
    return true;
  }
  toggleTrait(id) {
    const d = this.traitData(id);
    if (!d.lv) return;
    this.record.data.traits[id] = { lv: d.lv, on: !d.on };
    this.record.save();
  }
  // 켜 둔 체질의 단계 { id: lv } — 매 생(이어하기 포함) 시작할 때 state.traits로 넣는다
  activeLevels() {
    return Object.fromEntries(this.traits.filter((x) => this.traitOn(x.id)).map((x) => [x.id, this.traitLevel(x.id)]));
  }
  // 이 결과를 막는 켜 둔 체질의 지금 단계 (없으면 undefined)
  // choice를 넘기면 선택지에 따라 정해지는 막기(madDeath: 마공 선택지의 죽음)도 본다
  blocker(outcome, choice = null) {
    const hit = (b) => (b === "madDeath" ? !!choice?.madness && !!outcome.effects?.death : outcome[b]);
    for (const tr of this.traits) {
      if (!this.traitOn(tr.id)) continue;
      const tier = this.tierOf(tr);
      if (tier.blocks.some(hit)) return tier;
    }
  }
}
