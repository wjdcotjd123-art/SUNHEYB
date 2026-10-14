// 사용자 설정. 지금은 글자 크기만.
import { Store } from "../core/store.js";

export const FONT_SIZES = [
  { id: "s", label: "작게", px: 15 },
  { id: "m", label: "보통", px: 17 },
  { id: "l", label: "크게", px: 19 },
  { id: "xl", label: "아주 크게", px: 21 },
];

export class Settings {
  constructor(config) {
    this.key = config.storage.settings;
    this.data = { fontSize: "m", ...Store.get(this.key, {}) };
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
