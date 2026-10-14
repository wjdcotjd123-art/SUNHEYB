// 시드 가능한 난수. 같은 시드면 같은 결과가 나와서 버그 재현이 쉽다.
export class Rng {
  constructor(seed = Date.now()) {
    this.s = seed >>> 0;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  percent() {
    return this.next() * 100;
  }
  pickWeighted(list, weightOf) {
    const total = list.reduce((s, x) => s + weightOf(x), 0);
    let r = this.next() * total;
    for (const x of list) {
      r -= weightOf(x);
      if (r < 0) return x;
    }
    return list[list.length - 1];
  }
}
