// 언어 파일 읽기와 글 꺼내기. 화면에 나가는 모든 글은 여기를 거친다.
// 언어 파일: lang/<언어>/ui.json, events.json, achievements.json, items.json, names.json(인물·세력), glossary.json(용어 풀이)
const FILES = ["ui", "events", "achievements", "items", "names", "glossary", "codex"];

export class I18n {
  constructor(langDir) {
    this.langDir = langDir;
    this.packs = {};
    this.lang = null;
  }

  async use(lang) {
    if (!this.packs[lang]) {
      const inline = window.LANG_DATA?.[lang];
      this.packs[lang] =
        inline ??
        Object.fromEntries(
          await Promise.all(FILES.map(async (f) => [f, await (await fetch(`${this.langDir}/${lang}/${f}.json`)).json()]))
        );
    }
    this.lang = lang;
    this.p = this.packs[lang];
    document.documentElement.lang = lang;
  }

  // 화면 글자. 예: t("menu.title"), t("game.life", { n: 3 })
  t(path, vars) {
    let s = path.split(".").reduce((o, k) => o?.[k], this.p.ui);
    if (s == null) return path;
    if (vars && typeof s === "string") for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  }

  // 이벤트 글. 예: ev(id, "title"), ev(id, "c2.o0")
  ev(id, part) {
    const v = this.p.events[`${id}.${part}`] ?? `${id}.${part}`;
    return this.evFilter ? this.evFilter(id, v) : v;
  }

  ach(id, field) {
    return this.p.achievements[`${id}.${field}`] ?? id;
  }

  // 인과록 도감 글. part: "name" 또는 "s0", "s1" …
  codex(id, part) {
    return this.p.codex?.[`${id}.${part}`] ?? id;
  }

  item(id) {
    return this.p.items[id] ?? id.replaceAll("_", " ");
  }

  // 전투 글: combat("enemy.<id>.name"), combat("art.<id>.name")
  combat(key) {
    return this.p.combat?.[key] ?? key.split(".")[1].replaceAll("_", " ");
  }

  name(id) {
    return this.p.names?.[id] ?? id.replaceAll("_", " ");
  }

  // 소지품 설명: 용어 풀이가 있으면 그것, 없으면 인과록 도감의 첫 단계 글
  itemDesc(id) {
    return this.gloss(this.item(id)) ?? this.p.codex?.[`${id}.s0`] ?? null;
  }

  // 용어 풀이. 없으면 null
  gloss(term) {
    return this.p.glossary?.[term] ?? null;
  }

  stat(id) {
    return this.p.ui.stats?.[id] ?? id;
  }

  realm(n) {
    return this.p.ui.realms?.[n] ?? String(n);
  }
}
