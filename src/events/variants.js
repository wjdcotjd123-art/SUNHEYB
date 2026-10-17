// 장면 글 갈래: 조건에 맞으면 같은 장면의 글을 조금 바꿔 보여 준다.
// 장면에 "variants": [{ "when": {조건}, "terms": {"맹주": "사도련주"}, "lines": {"원래 줄": ["바뀐 줄", …]} }]
//  - terms: 글 속 낱말을 바꾼다(긴 낱말부터)
//  - lines: 줄 하나를 여러 줄로 바꾼다(빈 배열이면 그 줄을 지운다)
import { meetsCondition } from "./selector.js";

export class TextVariants {
  constructor(eventsById) {
    this.events = eventsById;
  }
  apply(id, value, state) {
    const ev = this.events.get(id);
    if (!ev?.variants || !state) return value;
    for (const v of ev.variants) {
      if (!meetsCondition(state, v.when)) continue;
      value = Array.isArray(value) ? this.applyLines(value, v) : this.applyTerms(value, v.terms);
    }
    return value;
  }
  applyLines(lines, v) {
    const out = [];
    for (const line of lines) {
      const rep = v.lines?.[line];
      const list = rep ?? [line];
      for (const l of list) out.push(this.applyTerms(l, v.terms));
    }
    return out;
  }
  applyTerms(s, terms) {
    if (!terms || typeof s !== "string") return s;
    const keys = Object.keys(terms).sort((a, b) => b.length - a.length);
    if (!keys.length) return s;
    const re = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
    return s.replace(re, (m) => terms[m]);
  }
}
