// 언어 파일 읽기와 글 꺼내기. 화면에 나가는 모든 글은 여기를 거친다.
// 언어 파일: lang/<언어>/ui.json, events.json, achievements.json, items.json, names.json(인물·세력), glossary.json(용어 풀이)
const FILES = ["ui", "events", "achievements", "items", "names", "glossary"];

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
    return this.p.events[`${id}.${part}`] ?? `${id}.${part}`;
  }

  ach(id, field) {
    return this.p.achievements[`${id}.${field}`] ?? id;
  }

  item(id) {
    return this.p.items[id] ?? id.replaceAll("_", " ");
  }

  name(id) {
    return this.p.names?.[id] ?? id.replaceAll("_", " ");
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
