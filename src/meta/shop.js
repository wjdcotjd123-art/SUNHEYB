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
    for (const it of this.items) state.stats[it.stat] = state.stat(it.stat) + it.amount * this.level(it.id);
  }
  // 특성: { 산 것: true/false(켜짐) }
  hasTrait(id) {
    return id in this.record.data.traits;
  }
  traitOn(id) {
    return this.record.data.traits[id] === true;
  }
  buyTrait(id) {
    const tr = this.traits.find((x) => x.id === id);
    if (!tr || this.hasTrait(id) || !this.record.spend(tr.price)) return false;
    this.record.data.traits[id] = true;
    this.record.save();
    return true;
  }
  toggleTrait(id) {
    if (!this.hasTrait(id)) return;
    this.record.data.traits[id] = !this.traitOn(id);
    this.record.save();
  }
  // 켜 둔 특성이 막는 결과 표시들
  blockedTags() {
    return this.traits.filter((x) => this.traitOn(x.id)).map((x) => x.blocks);
  }
}
