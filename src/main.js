// 게임 흐름: 생 시작 → 장면 → 선택 → 결과 → (연결 장면 or 다음 장면) → 죽음/끝 → 다음 생.
import { CONFIG } from "./config.js";
import { Rng } from "./core/rng.js";
import { GameState } from "./core/state.js";
import { EventLoader } from "./events/loader.js";
import { EventSelector } from "./events/selector.js";
import { ResultResolver } from "./events/resolver.js";
import { LifeRecord } from "./meta/lives.js";
import { GameView } from "./ui/view.js";

class Game {
  constructor(events) {
    this.rng = new Rng();
    this.selector = new EventSelector(events, this.rng, CONFIG);
    this.resolver = new ResultResolver(this.rng, CONFIG);
    this.record = new LifeRecord(CONFIG);
    this.view = new GameView(document, CONFIG);
  }

  startLife() {
    this.state = new GameState(CONFIG);
    const life = this.record.startLife();
    this.view.header(life, this.record.data.karma);
    this.view.stats(this.state);
    this.view.clear();
    this.play(this.selector.next(this.state));
  }

  play(ev) {
    if (!ev) return this.finish("end");
    const s = this.state;
    s.seen.add(ev.id);
    s.scenes += 1;
    this.view.scene(ev, this.selector.availableChoices(ev, s), (choice) => {
      const outcome = this.resolver.pick(choice, s);
      s.outcomesSeen.push(`${ev.id}:${choice.id}:${choice.outcomes.indexOf(outcome)}`);
      const changes = this.resolver.apply(outcome, s);
      this.view.stats(s);
      const nextId = outcome.effects?.next_event;
      if (s.dead) return this.view.outcome(outcome, changes, "눈을 감는다", () => this.finish("death"));
      this.view.outcome(outcome, changes, "계속", () =>
        this.play(nextId ? this.selector.byId(nextId) : this.selector.next(s))
      );
    });
  }

  finish(kind) {
    const summary = this.record.endLife(this.state);
    this.view.header(this.record.data.life, this.record.data.karma);
    this.view.ending(kind, summary, () => this.startLife());
  }
}

new EventLoader(CONFIG.eventIndex).load().then((events) => new Game(events).startLife());
