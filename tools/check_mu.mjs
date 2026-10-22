// 무협 검사기: 무작위로 여러 번 플레이해 길과 개연성을 검사한다.
// 쓰는 법: node tools/check_mu.mjs [횟수] [시드] [무관]
// 찾는 것: 처지(두목·부두목 등)와 어긋난 글 / 끊긴 길 / 한 번도 안 나온 장면 / 만난 적 없는 인물 / 떠난 사람이 다시 나옴 / 말을 모르는데 들리는 대사, 말을 아는데 가려진 대사
//         / 같이 켜질 수 없는 표시 / 장면 글 갈래(variants)의 없는 줄 / 결말·죽음 비율
// 문장의 앞뒤 흐름은 못 본다. 고친 줄기는 tools/flow_mu.py로 이어 붙여 직접 읽는다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../src/config.js";
import { GameState } from "../src/core/state.js";
import { Rng } from "../src/core/rng.js";
import { EventSelector, meetsCondition } from "../src/events/selector.js";
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
  향아: { flags: ["이름_앎"], intro: ["W001", "M011", "N023"] },
  소삼: { flags: ["이름_앎"], intro: ["W001", "M011"] },
  "엄 관주": { flags: ["백운_입관"], intro: ["B001", "B002"] },
  진호: { flags: ["백운_입관"], intro: ["B002", "B003"] },
  마철: { flags: ["백운_입관"], intro: ["B002", "B003"] },
};
// 떠난 사람: 표시가 있은 뒤 이름이 나오면 안 되는 장면(추모 장면은 예외)
const GONE = [{ flag: "장패_죽음", names: ["장패"], ok: ["N013", "N009"] }, { flag: "황칠_죽음", names: ["황칠"], ok: ["N009"] }, { flag: "소삼_잃음", names: ["소삼"], ok: ["W012", "W006"] }, { flag: "노인_떠남", names: ["우 영감", "영감이", "노인이", "노인의 집"], ok: ["V007", "W007", "V008", "V009", "V011", "V012", "V013"] }]; // ok: 추모하는 줄이 있는 장면
const EXCLUSIVE = [["혼인", "혼인_거절"], ["누명_벗음", "누명_남음"]];
const R = { dead: {}, people: {}, gone: {}, lang: {}, excl: {}, ends: {} };
const note = (bag, k, s = "") => { bag[k] ??= { n: 0, s }; bag[k].n++; };
const seenAll = new Set();
// 글 갈래 검사(정적)
const lint = [];
// 처지(신분) 검사(정적): 그 처지가 된 뒤에 나올 수 있는 장면을 모두, 그 처지의 표시를 켠 채 글 갈래까지 적용해 읽는다.
//  무작위로는 잘 안 닿는 처지(두목, 부두목 등)도 빠짐없이 본다. speech: 대사(" 로 시작하는 줄)에서만 찾는다.
const ROLES = [
  { name: "부두목", flags: ["장패_심복"], path: "녹풍채", words: [/(?<!새로 들어온 )막내(?!들)/], speech: true, skip: ["N001", "N002", "N003", "N009", "N012", "N013"] },
  { name: "두목", flags: ["녹풍_두목", "두목_바뀜", "장패_죽음", "황칠_죽음"], path: "녹풍채", words: [/(?<!새로 들어온 )막내(?!들)/, /장패/, /황칠/], speech: false, skip: ["N001", "N002", "N003", "N009", "N012", "N013"] },
  { name: "황칠 두목", flags: ["황칠_두목", "두목_바뀜", "장패_죽음"], path: "녹풍채", words: [/장패/, /(?<!새로 들어온 )막내(?!들)/], speech: true, skip: ["N001", "N002", "N003", "N009", "N012", "N013"] },
];
// 떠난 사람(정적): 그 표시가 켜진 채로 나올 수 있는 장면을 모두 읽어, 떠난 사람이 산 사람처럼 나오는지 찾는다.
const GONE_STATIC = [
  { flag: "소삼_잃음", names: ["소삼"], ok: ["W012", "W012B", "W006"], before: ["W001", "M011"] },
  { flag: "노인_떠남", names: ["우 영감", "영감이", "영감은", "영감의"], ok: ["V007", "V008", "V009", "V011", "V012", "V013", "W007"], before: ["M001", "M011", "M020", "W001"] },
]
const goneBad = [];
for (const g of GONE_STATIC) for (const e of Object.values(events)) {
  if (g.ok.includes(e.id) || g.before.includes(e.id) || e.pool === "chain") continue;
  const c0 = e.conditions ?? {};
  if ((c0.flags_none ?? []).includes(g.flag)) continue;
  const s = new GameState(CONFIG); s.flags.add(g.flag); (c0.flags ?? []).forEach((f) => s.flags.add(f)); if (c0.flags_any) s.flags.add(c0.flags_any[0]); s.path = e.path ?? null;
  for (const c of e.choices ?? []) {
    if ((c.condition?.flags_none ?? []).includes(g.flag)) continue;
    const lines = [...tv.apply(e.id, e.description, s), ...c.outcomes.filter((o) => !o.when || meetsCondition(s, o.when)).flatMap((o) => tv.apply(e.id, o.text, s))].filter((t) => typeof t === "string");
    for (const l of lines) { const t = plain([l]); if (g.names.some((n) => t.includes(n))) goneBad.push(`${g.flag} — ${e.id}.c${c.id}: ${t.slice(0, 44)}`); }
  }
}
// 틀어진 사이: 사이가 나쁜데(인연 -10 이하 또는 틀어진 표시) 그 사람이 나오는 장면을 모아, 글이 그 사이에 맞는지 사람이 읽어 본다.
const SOUR = { "우 영감": ["영감돈_훔침", "노인이_외면", "영감_실망"], "마 촌장": ["촌장_원한", "촌장_실각"], 장패: ["장패_의심"], 돌쇠: [], 향아: [], 소삼: [], 노가: [] };
const NAMEOF = { "우 영감": ["우 영감", "영감"], "마 촌장": ["마 촌장", "촌장"], 장패: ["장패"], 돌쇠: ["돌쇠"], 향아: ["향아"], 소삼: ["소삼"], 노가: ["노가"] };
R.sour = {};
const roleBad = [];
for (const role of ROLES) {
  for (const e of Object.values(events)) {
    if ((e.path ?? null) !== role.path || role.skip.includes(e.id)) continue;
    const none = [...(e.conditions?.flags_none ?? [])];
    if (role.flags.some((f) => none.includes(f))) continue; // 그 처지면 안 나오는 장면
    const s = new GameState(CONFIG); role.flags.forEach((f) => s.flags.add(f)); s.path = role.path;
    for (const c of e.choices ?? []) {
      if (c.condition && c.condition.flags_none?.some((f) => role.flags.includes(f))) continue;
      const lines = [...tv.apply(e.id, e.description, s), ...c.outcomes.filter((o) => !o.when || meetsCondition(s, o.when)).flatMap((o) => tv.apply(e.id, o.text, s))].filter((t) => typeof t === "string");
      for (const l of lines) {
        const t = plain([l]);
        if (role.speech && !/^["「]/.test(t)) continue;
        for (const w of role.words) if (w.test(t)) roleBad.push(`${role.name} — ${e.id}.c${c.id}: ${t.slice(0, 40)}`);
      }
    }
  }
}
for (const e of Object.values(events)) {
  const all = new Set([...(e.description ?? []), ...(e.choices ?? []).flatMap((c) => c.outcomes.flatMap((o) => o.text))]);
  for (const v of e.variants ?? []) for (const vals of Object.values(v.lines ?? {})) vals.forEach((x) => all.add(x));
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
    const pref = FOCUS ? cs.filter((x) => FOCUS_RE.test(x.text) && !/그만두|지나친|서두르지|달아난|도망/.test(x.text)) : [];
    const pool = pref.length ? pref : cs;
    const c = pool[Math.floor(rng.next() * pool.length)]; const o = res.pick(c, s);
    const before = new Set(s.flags);
    const text = plain(tv.apply(ev.id, ev.description, s)) + "\n" + plain(tv.apply(ev.id, o.text, s));
    s.scenes = (s.scenes ?? 0) + 1; res.apply(o, s);
    for (const [name, p] of Object.entries(PEOPLE)) if (text.includes(name) && !p.intro.includes(ev.id) && !p.flags.some((f) => before.has(f))) note(R.people, `${ev.id}.c${c.id}: '${name}'을 아직 모름`, [...before].filter((f) => /말_|이름|기억/.test(f)).join(","));
    for (const g of GONE) if (before.has(g.flag) && !g.ok.includes(ev.id)) for (const n of g.names) if (text.includes(n)) note(R.gone, `${ev.id}.c${c.id}: 떠난 뒤 '${n}'`);
    for (const [who, fl] of Object.entries(SOUR)) {
      const bad = (s.bonds?.[who] ?? 0) <= -10 || fl.some((f) => before.has(f));
      if (bad && NAMEOF[who].some((n) => text.includes(n))) note(R.sour, `${who} — ${ev.id}.c${c.id} ${ev.title}`, (s.bonds?.[who] ?? 0) + " " + fl.filter((f) => before.has(f)).join(","));
    }
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
const show = (t, bag) => { const es = Object.entries(bag).sort((a, b) => b[1].n - a[1].n); console.log(`■ ${t} (${es.length})`); es.slice(0, process.env.ALL ? 999 : 15).forEach(([k, v]) => console.log(`   ${String(v.n).padStart(5)}회  ${k}${v.s ? "  [" + v.s + "]" : ""}`)); };
console.log(`무협 검사: ${RUNS}회 (반은 언어 기억)`);
show("끊긴 길", R.dead); show("만난 적 없는 인물", R.people); show("떠난 사람이 다시 나옴", R.gone); show("말과 대사가 어긋남", R.lang); show("같이 켜질 수 없는 표시", R.excl);
console.log(`■ 글 갈래의 없는 줄 (${lint.length})`); lint.forEach((l) => console.log("   " + l));
const gb = [...new Set(goneBad)]; console.log(`■ 떠난 사람(모든 장면) (${gb.length})`); gb.slice(0, 40).forEach((l) => console.log("   " + l));
show("사이가 틀어졌는데 나온 장면 — 읽어서 확인", R.sour);
const rb = [...new Set(roleBad)]; console.log(`■ 처지와 어긋난 글 (${rb.length})`); rb.slice(0, 30).forEach((l) => console.log("   " + l));
const unseen = Object.keys(events).filter((id) => !seenAll.has(id) && !id.startsWith("SYS"));
console.log(`■ 한 번도 안 나온 장면 (${unseen.length}) ${unseen.join(" ")}`);
console.log("■ 끝나는 방식"); Object.entries(R.ends).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(`   ${(v.n / RUNS * 100).toFixed(1).padStart(5)}%  ${k}`));
