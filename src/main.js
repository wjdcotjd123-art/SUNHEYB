// 앱 흐름: 메인 화면 ↔ 플레이(장면 → 선택 → 결과 → 다음 장면) → 정산 → 메인.
import { CONFIG } from "./config.js";
import { Rng } from "./core/rng.js";
import { GameState } from "./core/state.js";
import { EventLoader } from "./events/loader.js";
import { EventSelector, meetsCondition } from "./events/selector.js";
import { ResultResolver } from "./events/resolver.js";
import { I18n } from "./i18n/i18n.js";
import { LifeRecord } from "./meta/lives.js";
import { Settings } from "./meta/settings.js";
import { KarmaShop } from "./meta/shop.js";
import { NoveltyWeigher } from "./events/novelty.js";
import { Battle } from "./combat/battle.js";
import { BattleScreen } from "./ui/battle.js";
import { SaveManager } from "./save/saveManager.js";
import { GameView } from "./ui/view.js";
import { MenuScreens } from "./ui/screens.js";
import { Tooltip } from "./ui/tooltip.js";

class App {
  constructor(events, achievements, codex, i18n, settings, combat) {
    this.codex = codex;
    this.combat = combat; // { enemies, arts }
    this.rng = new Rng();
    this.selector = new EventSelector(events, this.rng, CONFIG);
    this.resolver = new ResultResolver(this.rng, CONFIG);
    this.record = new LifeRecord(CONFIG);
    this.shop = new KarmaShop(CONFIG, this.record);
    this.novelty = new NoveltyWeigher(this.record, CONFIG);
    this.selector.useNovelty(this.novelty);
    this.saves = new SaveManager(CONFIG);
    this.settings = settings;
    this.i18n = i18n;
    this.achievements = achievements;
    this.view = new GameView(document, CONFIG, i18n);
    this.battleScreen = new BattleScreen(this.view, i18n);
    if (!CONFIG.showLog) document.body.classList.add("no-log");
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
        testKarma: CONFIG.testKarma ? () => this.record.grant(CONFIG.testKarma) : null,
        testBattle: CONFIG.testKarma ? () => this.openBattleTest() : null,
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
    this.state.pastBonds = { ...this.record.data.bondsMax };
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
    this.state.stats.체력 = this.state.stat("최대체력"); // 최대 체력으로 시작
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
    // '처음' 표시: 두 번째 생부터, 한 번도 골라 본 적 없는 선택지
    const isFresh = (c) => this.record.data.life > 1 && this.novelty.isFreshChoice(ev.id, c.id, s);
    this.view.chapter(s.scenes + 1);
    const choices = this.rankChoices(ev, s);
    this.view.scene(ev, choices, (choice) => {
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
      // 귀결: 이야기가 매듭지어지면 결과를 보여 준 뒤 생을 마친다
      if (s.ending) {
        this.saves.clear();
        return this.view.outcome(ev.id, choice.id, textKey, changes, "game.continue", () => this.finish("ending"), rare, !!outcome.fortune, textEv, trait?.name);
      }
      // 전투: 결과를 보여 준 뒤 전투 화면으로
      const fight = outcome.effects?.전투;
      if (fight) {
        this.saves.save(s, ev.id);
        return this.view.outcome(ev.id, choice.id, textKey, changes, "game.continue", () => this.fight(fight, ev, choice, oi), rare, !!outcome.fortune, textEv, trait?.name);
      }
      // 다음 장면을 지금 정해 저장해 둔다 (껐다 켜서 다시 고르기 방지).
      // 마기가 차오르면 다음 장면은 마두 발작
      const mad = CONFIG.madness;
      const nextId = s.stat(mad.stat) >= mad.threshold && ev.id !== mad.event ? mad.event : outcome.effects?.next_event;
      const next = nextId ? this.selector.byId(nextId) : this.selector.next(s);
      this.saves.save(s, next?.id ?? null);
      this.view.outcome(ev.id, choice.id, textKey, changes, "game.continue", () => this.play(next), rare, !!outcome.fortune, textEv, trait?.name);
    }, isFresh, !!ev.dejavu && meetsCondition(s, { past_bond_min: { [ev.dejavu.person]: ev.dejavu.min } }));
  }

  // 전투 한 판. fight = { enemy, lethal, win: {text, effects}, lose: {text, effects}, next? }
  // 지금 상태에서 이 선택지로 죽을 확률(%). 결과 판정(pick)·체질·검은 비늘 규칙을 그대로 따른다.
  deathChance(ev, choice, s) {
    const deaths = ev.memory === false ? 0 : this.record.deathsAt(ev.id, choice.id);
    const guard = CONFIG.scaleGuard;
    const saved = (o) => o.weak && s.hasItem(guard.item) && !s.flags.has(guard.usedFlag);
    const dies = (o) => this.resolver.kills(o, s) && !(o.effects?.death && saved(o));
    let outs = choice.outcomes.filter((o) => !this.shop.blocker(o));
    const reroll = outs.length && outs.length < choice.outcomes.length;
    if (reroll && !outs.some((o) => o.chance == null)) outs = outs.map((o, k) => (k === outs.length - 1 ? { ...o, chance: undefined, src: o } : o));
    const reDeath = reroll ? this.resolver.distribution({ ...choice, outcomes: outs }, s, deaths).reduce((a, [o, p]) => a + (dies(o.src ?? o) ? p : 0), 0) / 100 : 0;
    let total = 0;
    for (const [o0, p] of this.resolver.distribution(choice, s, deaths)) {
      const o = o0.src ?? o0;
      if (reroll && this.shop.blocker(o)) total += p * reDeath;
      else if (dies(o)) total += p;
    }
    return total;
  }

  // 죽을 확률이 기준 이상이면 비추천으로 표시하고 맨 뒤로 보낸다.
  rankChoices(ev, s) {
    const list = this.selector.availableChoices(ev, s).map((c) => ({ ...c, warn: this.deathChance(ev, c, s) >= CONFIG.warnDeath }));
    return [...list.filter((c) => !c.warn), ...list.filter((c) => c.warn)];
  }

  fight(fight, ev, choice, oi) {
    const s = this.state;
    const enemy = this.combat.enemies.find((x) => x.id === fight.enemy);
    const arts = this.combat.arts.filter((a) => meetsCondition(s, a.req));
    const battle = new Battle(this.rng, CONFIG, s, enemy, arts, this.combat.items ?? []);
    // 경지가 한 단계라도 높으면 싸울 것도 없이 이긴다
    const outclass = s.stat("경지") > enemy.realm;
    // 전투를 꺼 두면 화면 없이 공격만 주고받는 걸로 속으로 계산해 결과만 낸다
    const quiet = (done) => { while (!battle.over) battle.turn({ type: "attack" }); done(battle.over); };
    const run = outclass ? (done) => done("win") : CONFIG.combatEnabled ? (done) => this.battleScreen.run(battle, done) : quiet;
    run((result) => {
      battle.finish();
      // 목숨을 걸지 않은 싸움(lethal: false)은 져도 숨은 붙어 있다
      if (result === "lose" && fight.lethal === false) s.stats.체력 = Math.max(1, s.stat("체력"));
      const end = fight[result];
      const changes = this.resolver.apply({ effects: end.effects ?? {} }, s);
      s.log.push({ ev: ev.id, c: choice.id, changes, dead: s.dead });
      this.learnFrom(s, ev.id);
      this.view.stats(s);
      this.view.renderLog(s.log);
      const key = `c${choice.id}.o${oi}.${result}`;
      if (s.dead) {
        this.saves.clear();
        this.record.recordDeath(ev.id, choice.id);
        return this.view.outcome(ev.id, choice.id, key, changes, "game.closeEyes", () => this.finish("death"));
      }
      const next = fight.next ? this.selector.byId(fight.next) : this.selector.next(s);
      this.saves.save(s, next?.id ?? null);
      this.view.outcome(ev.id, choice.id, key, changes, "game.continue", () => this.play(next));
    });
  }

  // 시험용: 산적의 길목 전투만 따로 해 보기. 진행 중인 생과 기록에는 영향 없음
  openBattleTest() {
    const saved = this.saves.load()?.state;
    const base = saved ?? new GameState(CONFIG);
    const enemy = this.combat.enemies.find((x) => x.id === CONFIG.testBattleEnemy);
    this.menu.battleTest(base, this.combat.arts, this.combat.items ?? [], (stats, artIds, itemIds) => {
      const s = new GameState(CONFIG);
      s.items = [...itemIds];
      Object.assign(s.stats, stats);
      s.stats.체력 = s.stat("최대체력");
      const arts = this.combat.arts.filter((a) => artIds.includes(a.id));
      this.menu.hide();
      this.view.open(() => this.openBattleTest());
      this.view.header(this.record.data.life, this.record.data.karma);
      this.view.stats(s);
      const battle = new Battle(this.rng, CONFIG, s, enemy, arts, this.combat.items ?? []);
      this.battleScreen.run(battle, () => { battle.finish(); this.openBattleTest(); });
    }, () => this.openSettings());
  }

  finish(kind) {
    this.saves.clear();
    const summary = this.record.endLife(this.state);
    this.view.header(this.record.data.life, this.record.data.karma);
    this.view.lastEnding = this.state.ending;
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
  const [events, ach, codex, combat] = await Promise.all([loader.load(), loader.loadAchievements(), loader.loadCodex(), loader.loadCombat()]);
  new App(events, ach, codex, i18n, settings, combat).home();
}

boot();
