// 앱 흐름: 메인 화면 ↔ 플레이(장면 → 선택 → 결과 → 다음 장면) → 정산 → 메인.
import { CONFIG } from "./config.js";
import { Rng } from "./core/rng.js";
import { GameState } from "./core/state.js";
import { EventLoader } from "./events/loader.js";
import { EventSelector } from "./events/selector.js";
import { ResultResolver } from "./events/resolver.js";
import { LifeRecord } from "./meta/lives.js";
import { Settings } from "./meta/settings.js";
import { SaveManager } from "./save/saveManager.js";
import { GameView } from "./ui/view.js";
import { MenuScreens } from "./ui/screens.js";

class App {
  constructor(events, achievements) {
    this.rng = new Rng();
    this.selector = new EventSelector(events, this.rng, CONFIG);
    this.resolver = new ResultResolver(this.rng, CONFIG);
    this.record = new LifeRecord(CONFIG);
    this.saves = new SaveManager(CONFIG);
    this.settings = new Settings(CONFIG);
    this.achievements = achievements;
    this.view = new GameView(document, CONFIG);
    this.menu = new MenuScreens(document);
    this.settings.apply();
  }

  // ── 메인 화면 ──
  home() {
    this.view.close();
    this.menu.main(
      { lives: this.record.data.life, karma: this.record.data.karma, hasSave: this.saves.has() },
      {
        continue: () => this.continueLife(),
        newLife: () => this.newLife(),
        achievements: () =>
          this.menu.achievements(this.achievements, this.record.data.achievements, this.record.data.outcomes.length, () => this.home()),
        karma: () => this.menu.karma(this.record.data.karma, () => this.home()),
        settings: () =>
          this.menu.settings(
            this.settings.data,
            { fontSize: (id) => this.settings.set("fontSize", id), wipe: () => { this.record.wipe(); this.saves.clear(); } },
            () => this.home()
          ),
      }
    );
  }

  // ── 플레이 ──
  enterGame() {
    this.menu.hide();
    this.view.open(() => this.home());
    this.view.header(this.record.data.life, this.record.data.karma);
    this.view.stats(this.state);
    this.view.renderLog(this.state.log);
  }

  newLife() {
    this.saves.clear();
    this.state = new GameState(CONFIG);
    this.record.startLife();
    this.enterGame();
    this.play(this.selector.next(this.state));
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
    if (!s.seen.has(ev.id)) {
      s.seen.add(ev.id);
      s.scenes += 1;
    }
    this.saves.save(s, ev.id);
    this.view.scene(ev, this.selector.availableChoices(ev, s), (choice, sec) => {
      const outcome = this.resolver.pick(choice, s);
      s.outcomesSeen.push(`${ev.id}:${choice.id}:${choice.outcomes.indexOf(outcome)}`);
      const changes = this.resolver.apply(outcome, s);
      s.log.push({ title: ev.title, tag: choice.tag, changes, dead: s.dead });
      this.view.stats(s);
      this.view.renderLog(s.log);

      if (s.dead) {
        this.saves.clear();
        return this.view.outcome(sec, outcome, changes, "눈을 감는다", () => this.finish("death"));
      }
      // 다음 장면을 지금 정해 저장해 둔다 (껐다 켜서 다시 고르기 방지).
      const nextId = outcome.effects?.next_event;
      const next = nextId ? this.selector.byId(nextId) : this.selector.next(s);
      this.saves.save(s, next?.id ?? null);
      this.view.outcome(sec, outcome, changes, "계속", () => this.play(next));
    });
  }

  finish(kind) {
    this.saves.clear();
    const summary = this.record.endLife(this.state);
    this.view.header(this.record.data.life, this.record.data.karma);
    this.view.ending(kind, summary, () => this.home());
  }
}

const loader = new EventLoader(CONFIG.eventIndex, CONFIG.achievementsPath);
Promise.all([loader.load(), loader.loadAchievements()]).then(([events, ach]) => new App(events, ach).home());
