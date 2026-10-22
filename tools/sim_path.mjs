// 갈래(장) 안의 장면 순서를 무작위로 여러 번 돌려, 같은 장면이 몇 번 나오는지 본다.
// 쓰는 법: node tools/sim_path.mjs 녹풍채 [횟수]
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../src/config.js";
import { GameState } from "../src/core/state.js";
import { Rng } from "../src/core/rng.js";
import { EventSelector } from "../src/events/selector.js";
import { ResultResolver } from "../src/events/resolver.js";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/index.json"), "utf8"));
const events = {};
for (const f of idx.batches) for (const e of JSON.parse(fs.readFileSync(path.join(ROOT, "data/events", f), "utf8")).events) events[e.id] = e;
const PATH = process.argv[2] ?? "녹풍채", RUNS = Number(process.argv[3] ?? 2000);
const START = { 녹풍채: ["말_분기", "이름_앎", "말_트임", "녹풍채_입산"] }[PATH] ?? [];
const lens = [], reps = {}, samples = [];
for (let r = 0; r < RUNS; r++) {
  const rng = new Rng(7 * 100003 + r), sel = new EventSelector(new Map(Object.entries(events)), rng, CONFIG), res = new ResultResolver(rng, CONFIG);
  const s = new GameState(CONFIG); START.forEach((f) => s.flags.add(f)); s.path = PATH; s.scenes = 10;
  const seq = [];
  let ev = sel.next(s);
  for (let step = 0; step < 120 && ev; step++) {
    seq.push(ev.id); s.seen.add(ev.id); s.lastEventId = ev.id; s.recent = [...(s.recent ?? []), ev.id].slice(-3);
    const cs = sel.availableChoices(ev, s); const alive = cs.filter((c) => !c.outcomes.every((o) => o.effects?.death));
    const c = (alive.length ? alive : cs)[Math.floor(rng.next() * (alive.length || cs.length))];
    let o = res.pick(c, s); if (o.effects?.death) o = c.outcomes.find((x) => !x.effects?.death) ?? o; // 죽지 않는다고 치고 끝까지
    s.scenes++; res.apply(o, s);
    if (o.effects?.ending || o.effects?.next_event === "W021" || s.path !== PATH) { seq.push(o.effects?.ending ? "끝:" + o.effects.ending : "떠남"); break; }
    ev = o.effects?.next_event ? events[o.effects.next_event] : sel.next(s);
  }
  lens.push(seq.length);
  const cnt = {}; seq.forEach((id) => (cnt[id] = (cnt[id] ?? 0) + 1));
  for (const [id, n] of Object.entries(cnt)) { reps[id] ??= []; reps[id].push(n); }
  if (r < 5) samples.push(seq.join(" > "));
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log(`${PATH}: ${RUNS}회, 장면 수 평균 ${avg(lens)} (최소 ${Math.min(...lens)}, 최대 ${Math.max(...lens)})`);
for (const [id, a] of Object.entries(reps).sort()) console.log(`  ${id.padEnd(22)} 나온 판 ${String(a.length).padStart(5)}  한 판에 평균 ${avg(a)}회, 최대 ${Math.max(...a)}회  ${events[id]?.title ?? ""}`);
samples.forEach((x) => console.log("· " + x));
