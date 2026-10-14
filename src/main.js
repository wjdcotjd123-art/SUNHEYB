// 앱 흐름: 메인 화면 ↔ 플레이(장면 → 선택 → 결과 → 다음 장면) → 정산 → 메인.
import { CONFIG } from "./config.js";
import { Rng } from "./core/rng.js";
import { GameState } from "./core/state.js";
import { EventLoader } from "./events/loader.js";
import { EventSelector } from "./events/selector.js";
import { ResultResolver } from "./events/resolver.js";
import { I18n } from "./i18n/i18n.js";
import { LifeRecord } from "./meta/lives.js";
import { Settings } from "./meta/settings.js";
import { KarmaShop } from "./meta/shop.js";
import { SaveManager } from "./save/saveManager.js";
import { GameView } from "./ui/view.js";
import { MenuScreens } from "./ui/screens.js";
import { Tooltip } from "./ui/tooltip.js";

class App {
  constructor(events, achievements, codex, i18n, settings) {
    this.codex = codex;
    this.rng = new Rng();
    this.selector = new EventSelector(events, this.rng, CONFIG);
    this.resolver = new ResultResolver(this.rng, CONFIG);
    this.record = new LifeRecord(CONFIG);
    this.shop = new KarmaShop(CONFIG, this.record);
    this.saves = new SaveManager(CONFIG);
    this.settings = settings;
    this.i18n = i18n;
    this.achievements = achievements;
    this.view = new GameView(document, CONFIG, i18n);
    this.menu = new MenuScreens(document, i18n);
  }

  // ── 메인 화면 ──
  home() {
    this.view.close();
    this.menu.main(
      { lives: this.record.data.life, karma: this.record.data.karma, hasSave: this.saves.has() },
      {
        continue: () => this.continueLife(),
        newLife: () => this.newLife(),
        achievements: () => this.menu.codex(this.codex, this.achievements, this.record, () => this.home()),
        karma: () => this.openShop(),
        settings: () => this.openSettings(),
      }
    );
  }

  openShop() {
    this.menu.karma(
      this.record.data.karma,
      this.shop,
      (id) => { this.shop.buy(id); this.openShop(); },
      () => this.home(),
      { buy: (id) => { this.shop.buyTrait(id); this.openShop(); }, toggle: (id) => { this.shop.toggleTrait(id); this.openShop(); } }
    );
  }

  async openSettings() {
    const langs = await Promise.all(
      CONFIG.languages.map(async (id) => {
        await this.i18n.use(id);
        return { id, name: this.i18n.t("lang.name") };
      })
    );
    await this.i18n.use(this.settings.data.language);
    this.menu.settings(
      this.settings.data,
      langs,
      {
        fontSize: (id) => this.settings.set("fontSize", id),
        termMode: (id) => this.settings.set("termMode", id),
        language: async (id) => { this.settings.set("language", id); await this.i18n.use(id); this.openSettings(); },
        wipe: () => { this.record.wipe(); this.saves.clear(); },
      },
      () => this.home()
    );
  }

  // 인과록 도감: 지금 상태에서 알게 된 것을 기록
  learnFrom(s, evId) {
    this.record.learn([
      `ev:${evId}`,
      ...[...s.flags].map((f) => `flag:${f}`),
      ...s.items.map((x) => `item:${x}`),
      ...Object.keys(s.bonds).map((b) => `bond:${b}`),
      ...s.achievements.map((a) => `ach:${a}`),
      ...(s.affiliation ? [`aff:${s.affiliation}`] : []),
    ]);
  }

  // ── 플레이 ──
  enterGame() {
    this.menu.hide();
    this.state.traits = this.shop.activeLevels();
    this.view.termContext = { mode: () => this.settings.data.termMode, counts: this.state.termCounts };
    this.view.open(() => this.home());
    this.view.header(this.record.data.life, this.record.data.karma);
    this.view.stats(this.state);
    this.view.renderLog(this.state.log);
  }

  newLife() {
    this.saves.clear();
    this.state = new GameState(CONFIG);
    this.state.stats.업 = this.record.data.karmaEarned; // 지금까지 쌓은 업 총량이 확률 보정에 쓰인다 (화면에는 안 보임)
    this.shop.apply(this.state);
    this.record.learn(this.state.items.map((x) => `item:${x}`));
    const life = this.record.startLife();
    this.enterGame();
    const first = this.selector.byId(CONFIG.prologueId);
    // 도입부(intro)는 맨 첫 생에만 보여준다.
    if (first?.intro && life === 1) return this.view.intro(first.id, () => this.play(first));
    this.play(first ?? this.selector.next(this.state));
  }

  continueLife() {
    const saved = this.saves.load();
    if (!saved) return this.home();
    this.state = saved.state;
    this.enterGame();
    this.play(saved.eventId ? this.selector.byId(saved.eventId) : null);
  }

  play(ev) {
    if (!ev) return this.finish("end");
    const s = this.state;
    s.seen.add(ev.id);
    if (ev.situation) s.situation = ev.situation; // 상황 장면에 들어서면 그 상황에 처한다
    s.lastEventId = ev.id;
    s.recent = [...(s.recent ?? []), ev.id].slice(-3);
    this.saves.save(s, ev.id);
    this.view.scene(ev, this.selector.availableChoices(ev, s), (choice) => {
      s.scenes += 1;
      // memory=false인 장면(첫 장면 등)은 전생의 기억 보정을 받지 않는다.
      const deaths = ev.memory === false ? 0 : this.record.deathsAt(ev.id, choice.id);
      let outcome = this.resolver.pick(choice, s, deaths);
      // 체질: 켜 둔 체질이 막는 결과가 나오면 그 결과들을 빼고 다시 굴린다.
      let trait = this.shop.blocker(outcome);
      if (trait) {
        let outs = choice.outcomes.filter((o) => !this.shop.blocker(o));
        if (!outs.length) trait = null;
        else {
          // 남은 결과에 기본 결과(chance 없음)가 없으면 마지막 결과를 기본으로
          if (!outs.some((o) => o.chance == null)) outs = outs.map((o, k) => (k === outs.length - 1 ? { ...o, chance: undefined, src: o } : o));
          const re = this.resolver.pick({ ...choice, outcomes: outs }, s, deaths);
          outcome = re.src ?? re;
        }
      }
      // 확률 보정 때문에 결과가 복사본일 수 있어서, 원본 위치는 src나 글로 찾는다
      const oi = choice.outcomes.findIndex((o) => o === outcome || o === outcome.src || o.text === outcome.text);
      let textKey = `c${choice.id}.o${oi}`;
      let textEv = ev.id;
      s.outcomesSeen.push(`${ev.id}:${textKey}`);
      // 검은 비늘: 수준 낮은 적에게 죽을 뻔하면 한 번 막아준다.
      const guard = CONFIG.scaleGuard;
      if (outcome.effects?.death && outcome.weak && s.hasItem(guard.item) && !s.flags.has(guard.usedFlag)) {
        outcome = this.selector.byId(guard.event).choices[0].outcomes[0];
        textEv = guard.event;
        textKey = "c1.o0";
      }
      const rare = this.resolver.isRare(outcome);
      if (rare) s.rare += 1;
      const changes = this.resolver.apply(outcome, s);
      s.log.push({ ev: ev.id, c: choice.id, changes, dead: s.dead });
      this.learnFrom(s, ev.id);
      this.view.stats(s);
      this.view.renderLog(s.log);

      if (s.dead) {
        this.saves.clear();
        this.record.recordDeath(ev.id, choice.id);
        return this.view.outcome(ev.id, choice.id, textKey, changes, "game.closeEyes", () => this.finish("death"), rare, !!outcome.fortune, textEv, trait?.name);
      }
      // 다음 장면을 지금 정해 저장해 둔다 (껐다 켜서 다시 고르기 방지).
      const nextId = outcome.effects?.next_event;
      const next = nextId ? this.selector.byId(nextId) : this.selector.next(s);
      this.saves.save(s, next?.id ?? null);
      this.view.outcome(ev.id, choice.id, textKey, changes, "game.continue", () => this.play(next), rare, !!outcome.fortune, textEv, trait?.name);
    });
  }

  finish(kind) {
    this.saves.clear();
    const summary = this.record.endLife(this.state);
    this.view.header(this.record.data.life, this.record.data.karma);
    this.view.ending(kind, summary, () => this.home());
  }
}

async function boot() {
  const settings = new Settings(CONFIG);
  settings.apply();
  const i18n = new I18n(CONFIG.langDir);
  const lang = CONFIG.languages.includes(settings.data.language) ? settings.data.language : CONFIG.defaultLanguage;
  await i18n.use(lang);
  new Tooltip(document, i18n);
  const loader = new EventLoader(CONFIG.eventIndex, CONFIG.achievementsPath, CONFIG.codexPath);
  const [events, ach, codex] = await Promise.all([loader.load(), loader.loadAchievements(), loader.loadCodex()]);
  new App(events, ach, codex, i18n, settings).home();
}

boot();
