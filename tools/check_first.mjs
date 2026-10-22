// 무협 첫 생 검사: 무작위로 여러 번 플레이해 끝나는 방식(죽음/귀결/끊김)과 장면 등장 횟수를 센다.
// 쓰는 법: node tools/check_first.mjs [횟수] [언어기억 0/1]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../src/config.js";
import { GameState } from "../src/core/state.js";
import { Rng } from "../src/core/rng.js";
import { EventSelector } from "../src/events/selector.js";
import { ResultResolver } from "../src/events/resolver.js";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = Number(process.argv[2] ?? 2000), LANG = process.argv[3] === "1";
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const events = {};
for (const f of load("data/events/index.json").batches) for (const e of load(`data/events/${f}`).events ?? []) events[e.id] = e;
const ends = {}, seen = {}, lens = [];
for (let r = 0; r < RUNS; r++) {
  const rng = new Rng(7919 * r + 1), sel = new EventSelector(new Map(Object.entries(events)), rng, CONFIG), res = new ResultResolver(rng, CONFIG);
  const s = new GameState(CONFIG); if (LANG) s.flags.add("기억_언어");
  let ev = events[CONFIG.prologueId], end = "끊김";
  for (let step = 0; step < 200 && ev; step++) {
    seen[ev.id] = (seen[ev.id] ?? 0) + 1; s.seen.add(ev.id); s.lastEventId = ev.id; s.recent = [...(s.recent ?? []), ev.id].slice(-3); s.scenes = (s.scenes ?? 0) + 1;
    const cs = sel.availableChoices(ev, s); if (!cs.length) { end = `선택지없음:${ev.id}`; break; }
    const c = cs[Math.floor(rng.next() * cs.length)], o = res.pick(c, s); res.apply(o, s);
    if (o.effects?.death) { end = `죽음:${ev.id}`; break; }
    if (s.ending) { end = `귀결:${s.ending}`; break; }
    const nx = o.effects?.next_event;
    ev = nx ? events[nx] : sel.next?.(s) ?? sel.pick?.(s);
    if (!ev && CONFIG.fallbackEvents?.[s.stat("경지")]) ev = events[CONFIG.fallbackEvents[s.stat("경지")]];
  }
  ends[end] = (ends[end] ?? 0) + 1; lens.push(s.scenes);
}
console.log(`첫 생 검사 ${RUNS}회${LANG ? " (언어 기억)" : ""}`);
Object.entries(ends).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${(v / RUNS * 100).toFixed(1)}%`));
console.log("장면 등장(판당 평균):", Object.entries(seen).map(([k, v]) => `${k} ${(v / RUNS).toFixed(2)}`).join(" · "));
