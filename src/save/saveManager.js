// 진행 중인 생 저장/불러오기. "다음에 볼 장면"까지 함께 저장해서
// 결과를 본 뒤 껐다 켜도 선택을 다시 할 수 없게 한다.
import { Store } from "../core/store.js";
import { GameState } from "../core/state.js";

export class SaveManager {
  constructor(config) {
    this.config = config;
    this.key = config.storage.save;
  }
  has() {
    return !!Store.get(this.key);
  }
  save(state, eventId) {
    Store.set(this.key, {
      eventId,
      state: {
        stats: state.stats,
        items: state.items,
        flags: [...state.flags],
        bonds: state.bonds,
        reputation: state.reputation,
        affiliation: state.affiliation,
        situation: state.situation ?? null,
        ending: state.ending ?? null,
        seen: [...state.seen],
        outcomesSeen: state.outcomesSeen,
        achievements: state.achievements,
        scenes: state.scenes,
        stagnant: state.stagnant ?? 0,
        lastEventId: state.lastEventId,
        recent: state.recent,
        termCounts: state.termCounts,
        rare: state.rare,
        log: state.log,
      },
    });
  }
  // 메인 화면용: 저장된 생이 몇 장의 어느 장면에 멈춰 있는지
  peek() {
    const raw = Store.get(this.key);
    return raw ? { chapter: (raw.state?.scenes ?? 0) + 1, eventId: raw.eventId } : null;
  }
  load() {
    const raw = Store.get(this.key);
    if (!raw) return null;
    const s = new GameState(this.config);
    Object.assign(s, raw.state, { flags: new Set(raw.state.flags), seen: new Set(raw.state.seen) });
    return { state: s, eventId: raw.eventId };
  }
  clear() {
    Store.remove(this.key);
  }
}
