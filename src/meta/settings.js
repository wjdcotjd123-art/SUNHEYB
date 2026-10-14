// 사용자 설정: 글자 크기, 언어.
import { Store } from "../core/store.js";

export const FONT_SIZES = [
  { id: "s", px: 15 },
  { id: "m", px: 17 },
  { id: "l", px: 19 },
  { id: "xl", px: 21 },
];

export class Settings {
  constructor(config) {
    this.key = config.storage.settings;
    this.data = { fontSize: "m", language: config.defaultLanguage, ...Store.get(this.key, {}) };
  }
  set(k, v) {
    this.data[k] = v;
    Store.set(this.key, this.data);
    this.apply();
  }
  apply() {
    const f = FONT_SIZES.find((x) => x.id === this.data.fontSize) ?? FONT_SIZES[1];
    document.documentElement.style.setProperty("--fs", `${f.px}px`);
  }
}
