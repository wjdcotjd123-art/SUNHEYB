// 무협 검사기: 무작위로 여러 번 플레이해 길과 개연성을 검사한다.
// 쓰는 법: node tools/check_mu.mjs [횟수] [시드] [무관]
// 찾는 것: 끊긴 길 / 한 번도 안 나온 장면 / 만난 적 없는 인물 / 떠난 사람이 다시 나옴 / 말을 모르는데 들리는 대사, 말을 아는데 가려진 대사
//         / 같이 켜질 수 없는 표시 / 장면 글 갈래(variants)의 없는 줄 / 결말·죽음 비율
// 문장의 앞뒤 흐름은 못 본다. 고친 줄기는 tools/flow_mu.py로 이어 붙여 직접 읽는다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../src/config.js";
import { GameState } from "../src/core/state.js";
import { Rng } from "../src/core/rng.js";
import { EventSelector } from "../src/events/selector.js";
import { ResultResolver } from "../src/events/resolver.js";
import { TextVariants } from "../src/events/variants.js";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = Number(process.argv[2] ?? 3000), SEED = Number(process.argv[3] ?? 1), FOCUS = process.argv[4]; // FOCUS=무관: 무공 쪽 선택지를 골라 이류·사범 길을 검사
const FOCUS_RE = /무관|문을 두드|버틴|버틴다|가부좌|토납|삼재|정면|버릇|기운을|마보|청한|구절|숨을 고른|반복한다|받는다|술 한 병|흉내/;
const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const events = {};
for (const f of load("data/events/index.json").batches) for (const e of load(`data/events/${f}`).events ?? []) events[e.id] = e;
const tv = new TextVariants(new Map(Object.entries(events)));
const plain = (ls) => (ls ?? []).filter((t) => typeof t === "string").join("\n").replace(/\*\*|<\/?\w+>|\{|\}/g, "");
const LANG = ["말_트임", "기억_언어"];
// 인물: 이름이 글에 나오려면 이 표시 중 하나가 장면 전에 있어야 한다(intro 장면은 예외)
const PEOPLE = {
  "우 영감": { flags: ["이름_앎"], intro: ["W001", "M011"] },
  "마 촌장": { flags: ["이름_앎"], intro: ["W001", "M011"] },
  향아: { flags: ["이름_앎"], intro: ["W001", "M011"] },
  소삼: { flags: ["이름_앎"], intro: ["W001", "M011"] },
  "엄 관주": { flags: ["백운_입관"], intro: ["B001", "B002"] },
  진호: { flags: ["백운_입관"], intro: ["B002", "B003"] },
  마철: { flags: ["백운_입관"], intro: ["B002", "B003"] },
};
// 떠난 사람: 표시가 있은 뒤 이름이 나오면 안 되는 장면(추모 장면은 예외)
const GONE = [{ flag: "노인_떠남", names: ["우 영감", "영감이", "노인이", "노인의 집"], ok: ["V007", "W007", "V008", "V009", "V011", "V012", "V013"] }]; // ok: 추모하는 줄이 있는 장면
const EXCLUSIVE = [["혼인", "혼인_거절"], ["백운_떠남", "마무리_관주"]];
const R = { dead: {}, people: {}, gone: {}, lang: {}, excl: {}, ends: {} };
const note = (bag, k, s = "") => { bag[k] ??= { n: 0, s }; bag[k].n++; };
const seenAll = new Set();
// 글 갈래 검사(정적)
const lint = [];
for (const e of Object.values(events)) {
  const all = new Set([...(e.description ?? []), ...(e.choices ?? []).flatMap((c) => c.outcomes.flatMap((o) => o.text))]);
  for (const v of e.variants ?? []) for (const k of Object.keys(v.lines ?? {})) if (!all.has(k)) lint.push(`${e.id}: 갈래 줄이 없음 「${k.slice(0, 30)}」`);
  for (const c of e.choices ?? []) for (const o of c.outcomes) if (!o.effects?.death && !o.effects?.next_event && !o.effects?.ending && e.pool === "chain" && !(o.effects?.flags ?? []).length && false) lint.push(e.id);
}
for (let r = 0; r < RUNS; r++) {
  const rng = new Rng(SEED * 100003 + r), sel = new EventSelector(new Map(Object.entries(events)), rng, CONFIG), res = new ResultResolver(rng, CONFIG);
  const s = new GameState(CONFIG); if (r % 2) s.flags.add("기억_언어");
  let ev = events[CONFIG.prologueId], end = "끊김";
  for (let step = 0; step < 250 && ev; step++) {
    seenAll.add(ev.id); s.seen.add(ev.id); s.lastEventId = ev.id; s.recent = [...(s.recent ?? []), ev.id].slice(-3);
    const cs = sel.availableChoices(ev, s); if (!cs.length) { note(R.dead, `${ev.id}: 고를 선택지 없음`); end = "선택지없음"; break; }
    const pref = FOCUS ? cs.filter((x) => FOCUS_RE.test(x.text) && !/그만두|지나친/.test(x.text)) : [];
    const pool = pref.length ? pref : cs;
    const c = pool[Math.floor(rng.next() * pool.length)]; const o = res.pick(c, s);
    const before = new Set(s.flags);
    const text = plain(tv.apply(ev.id, ev.description, s)) + "\n" + plain(tv.apply(ev.id, o.text, s));
    s.scenes = (s.scenes ?? 0) + 1; res.apply(o, s);
    for (const [name, p] of Object.entries(PEOPLE)) if (text.includes(name) && !p.intro.includes(ev.id) && !p.flags.some((f) => before.has(f))) note(R.people, `${ev.id}.c${c.id}: '${name}'을 아직 모름`, [...before].filter((f) => /말_|이름|기억/.test(f)).join(","));
    for (const g of GONE) if (before.has(g.flag) && !g.ok.includes(ev.id)) for (const n of g.names) if (text.includes(n)) note(R.gone, `${ev.id}.c${c.id}: 떠난 뒤 '${n}'`);
    const knows = LANG.some((f) => before.has(f));
    if (knows && text.includes("◇")) note(R.lang, `${ev.id}.c${c.id}: 말을 아는데 ◇`);
    if (!LANG.some((f) => before.has(f)) && !before.has("말_분기") && /^"(?!여기가|열어|…여기)/m.test(plain(tv.apply(ev.id, ev.description, s))) && ev.id !== "M020") note(R.lang, `${ev.id}: 말을 모르는데 들리는 대사(지문)`);
    for (const [a, b] of EXCLUSIVE) if (s.flags.has(a) && s.flags.has(b)) note(R.excl, `${a} + ${b}`, ev.id);
    if (o.effects?.death) { end = `죽음:${ev.id}`; break; }
    if (s.ending) { end = `귀결:${s.ending}`; break; }
    const nx = o.effects?.next_event; ev = nx ? events[nx] : sel.next(s);
    if (!ev && CONFIG.fallbackEvents?.[s.stat("경지")]) ev = events[CONFIG.fallbackEvents[s.stat("경지")]];
  }
  if (end === "끊김") note(R.dead, `끊김(장면 ${s.scenes})`, s.lastEventId);
  note(R.ends, end);
}
const show = (t, bag) => { const es = Object.entries(bag).sort((a, b) => b[1].n - a[1].n); console.log(`■ ${t} (${es.length})`); es.slice(0, 15).forEach(([k, v]) => console.log(`   ${String(v.n).padStart(5)}회  ${k}${v.s ? "  [" + v.s + "]" : ""}`)); };
console.log(`무협 검사: ${RUNS}회 (반은 언어 기억)`);
show("끊긴 길", R.dead); show("만난 적 없는 인물", R.people); show("떠난 사람이 다시 나옴", R.gone); show("말과 대사가 어긋남", R.lang); show("같이 켜질 수 없는 표시", R.excl);
console.log(`■ 글 갈래의 없는 줄 (${lint.length})`); lint.forEach((l) => console.log("   " + l));
const unseen = Object.keys(events).filter((id) => !seenAll.has(id) && !id.startsWith("SYS"));
console.log(`■ 한 번도 안 나온 장면 (${unseen.length}) ${unseen.join(" ")}`);
console.log("■ 끝나는 방식"); Object.entries(R.ends).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(`   ${(v.n / RUNS * 100).toFixed(1).padStart(5)}%  ${k}`));
