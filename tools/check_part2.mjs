// 2부(이어진 길) 개연성 검사기: 무작위로 여러 번 플레이해 구조 문제를 찾는다.
// 사용: node tools/check_part2.mjs [횟수=3000] [시드=1]
// 찾는 것: 길이 끊기는 곳 / 한 번도 안 나오는 장면 / 만난 적 없는 인물이 나오는 장면 /
//          같이 켜질 수 없는 표시 / 반복이 아닌데 두 번 나온 장면
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "../src/config.js";
import { GameState } from "../src/core/state.js";
import { Rng } from "../src/core/rng.js";
import { EventSelector, meetsCondition } from "../src/events/selector.js";
import { ResultResolver } from "../src/events/resolver.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PATH = "이어진_길";
const RUNS = Number(process.argv[2] ?? 3000);
const SEED = Number(process.argv[3] ?? 1);
// 죽음만 있는 게 의도된 선택지(천기누설 등)
const DEATH_OK = (ev, c) => c.tag === "누설";
// 지난 생 기록을 흉내 낼 확률(지난 생 조건 장면도 나오게)
const PAST = { achievements: ["화산의_인연", "매화검수", "가주의_선물", "숙적", "다시_핀_매화"], known: ["aff:흑풍채", "flag:우강_죽음", "flag:유진_잃음", "flag:소월_잃음", "flag:소월의_죽", "flag:연화린_잃음", "flag:우강_무덤", "item:유진의_은장도", "ev:W01", "aff:청하무관", "ev:D009", "flag:조력_남궁현"] };

// 인물 이름 → 만났다는 표시(하나라도 있으면 만난 것). 이름이 본문에 나오는데 표시가 없으면 경고.
// 새 인물을 넣으면 여기에 더한다. intro: 그 인물을 처음 소개하는 장면(그 장면에서는 경고하지 않음)
const PEOPLE = {
  "엄 대주": { flags: ["말림_토벌"], intro: ["S02"] },
  하원: { flags: ["하원_구함", "하원_죽음"], intro: ["S03"] },
  곰배: { flags: ["곰배_원한"], intro: ["S02"] },
  "노 씨": { flags: ["노씨_재회", "봇짐_만남"], intro: ["Q17", "Q05"] },
  철우강: { flags: ["우강_봄"], intro: ["Q08", "S04"] },
  연화린: { flags: ["화린_봄"], intro: ["Q07", "S08"] },
  유진: { flags: ["유진_봄"], intro: ["Q06", "S09"] },
  남궁현: { flags: ["남궁현_봄"], intro: ["Q35", "S02"] },
  소월: { flags: ["소월_봄"], intro: ["Q33", "S05"] },
};
// 같이 켜질 수 없는 표시
const EXCLUSIVE = [
  ["하원_구함", "하원_죽음"],
  ["흑풍_은혜", "흑풍_원한"],
  ["마교_살려보냄", "마교_원한"],
  ["화린_중립", "화린_적대"], ["남궁현_도움", "남궁현_적대"], ["우강_도움", "우강_적대"], ["소월_도움", "소월_적대"], ["유진_중립", "유진_적대"],
  ["남궁현_살생", "남궁현_약속"], ["유진_살생", "유진_동지"], ["소월_살생", "소월_빚"], ["소월_살생", "소월_당부"],
];

const load = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const index = load("data/events/index.json");
const files = Object.values(index).find(Array.isArray);
const events = {};
for (const f of files) for (const e of load(`data/events/${f}`).events ?? []) events[e.id] = e;
const part2 = Object.values(events).filter((e) => e.path === PATH);
// 정적 검사: 효과 값이 올바른지(피해·회복 단계 등)
const lint = [];
const tiers = CONFIG.hpTiers;
const walkFx = (fx, where) => {
  for (const [k, v] of Object.entries(fx ?? {})) {
    if ((k === "피해" || k === "회복") && !(v in tiers[k])) lint.push(`${where}: ${k}=${v} (단계가 아님)`);
    if (k === "if") v.forEach((c, i) => walkFx(c.effects, `${where}.if${i}`));
    if (k === "전투") ["win", "lose"].forEach((r) => walkFx(v[r]?.effects, `${where}.${r}`));
  }
};
for (const e of part2) for (const c of e.choices ?? []) for (const o of c.outcomes ?? []) walkFx(o.effects, `${e.id}.c${c.id}`);

const plainOf = (lines) => (lines ?? []).filter((t) => typeof t === "string").join(" ").replace(/\*\*|<\/?\w+>/g, "");

const report = { runs: RUNS, deadEnds: {}, unseen: [], people: {}, exclusive: {}, twice: {}, ends: {} };
const seen = new Set();
const reach = {};
const MILESTONES = { R01: "확신", U01: "남쪽의 모닥불", U03: "초절정(제단의 장로)", U04: "총단 앞", V02: "천마 대면", V04: "천마 결착", X03: "흰 옷의 소년", X04: "화로 앞의 노인", Y01: "화경", Y04: "현경", Y07: "원흉 결착", Y09: "정사대전 종식", Y11: "연기기 1층", Y12: "그분(2부의 끝)", S01: "정사대전 시작", S06: "누구의 소행인가", S07: "검은 깃발", S10: "연화린 반응", S11: "남궁현 반응", S12: "철우강 반응", S13: "소월 반응", S14: "유진 반응", S15: "연화린 당부", S16: "유진 당부", S17: "소월 당부", S18: "남궁현 당부" };
const note = (bag, key, sample) => { bag[key] ??= { n: 0, sample }; bag[key].n++; };

for (let run = 0; run < RUNS; run++) {
  const rng = new Rng(SEED * 100003 + run);
  const sel = new EventSelector(new Map(Object.entries(events)), rng, CONFIG);
  const res = new ResultResolver(rng, CONFIG);
  const s = new GameState(CONFIG);
  s.path = PATH;
  s.stats["경지"] = 3;
  if (run % 2) { s.pastAchievements = PAST.achievements.filter(() => rng.next() < 0.5); s.pastKnown = PAST.known.filter(() => rng.next() < 0.5); }
  let ev = events.Q00;
  const visited = new Map();
  for (let step = 0; step < 300 && ev; step++) {
    seen.add(ev.id);
    if (MILESTONES[ev.id] && visited.get(ev.id) === undefined) reach[ev.id] = (reach[ev.id] ?? 0) + 1;
    visited.set(ev.id, (visited.get(ev.id) ?? 0) + 1);
    if (visited.get(ev.id) === 2 && !ev.repeat && ev.pool !== "chain") note(report.twice, ev.id, step);
    const choices = sel.availableChoices(ev, s);
    if (!choices.length) { note(report.deadEnds, `${ev.id}: 고를 선택지 없음`, [...s.flags].slice(-6).join(",")); break; }
    const choice = choices[Math.floor(rng.next() * choices.length)];
    let out = res.pick(choice, s);
    // 끝까지 가 보려고 죽음은 피한다(살아남는 결과로 바꿈)
    if (out.effects?.death) out = choice.outcomes.find((o) => !o.effects?.death) ?? null;
    if (!out) { if (!DEATH_OK(ev, choice)) note(report.ends, `죽음만 있는 선택지 ${ev.id}.c${choice.id}`, ""); break; }
    const before = new Set(s.flags);
    const fight = out.effects?.["전투"];
    res.apply(out, s);
    if (fight?.win?.effects) res.apply({ effects: fight.win.effects }, s);
    // 인물 검사: 이 장면 글에 나오는 이름의 '만남' 표시가 장면에 들어오기 전에 있었는가
    const text = plainOf(ev.description) + " " + plainOf(out.text);
    for (const [name, p] of Object.entries(PEOPLE)) {
      if (!text.includes(name) || p.intro.includes(ev.id)) continue;
      const met = p.flags.some((f) => before.has(f));
      if (!met) note(report.people, `${ev.id}: '${name}'을(를) 만난 적 없음`, choice.id);
    }
    for (const [a, b] of EXCLUSIVE) if (s.flags.has(a) && s.flags.has(b)) note(report.exclusive, `${a} + ${b}`, ev.id);
    if (s.ending) { note(report.ends, `귀결 ${ev.id}`, ""); break; }
    const nextId = fight?.next ?? out.effects?.next_event;
    let next = nextId ? events[nextId] : sel.next(s);
    if (!next) {
      note(report.deadEnds, `경지 ${s.stat("경지")}에서 장면이 떨어짐 (마지막: ${ev.id} ${ev.title})`, [...s.flags].slice(-8).join(","));
      break;
    }
    ev = next;
  }
}
report.unseen = part2.filter((e) => !seen.has(e.id) && !["P004", "P005"].includes(e.id)).map((e) => `${e.id} ${e.title}`);

const show = (title, bag) => {
  const rows = Object.entries(bag).sort((a, b) => b[1].n - a[1].n);
  console.log(`\n■ ${title} (${rows.length})`);
  for (const [k, v] of rows.slice(0, 25)) console.log(`  ${String(v.n).padStart(5)}회  ${k}${v.sample !== "" ? `  [${v.sample}]` : ""}`);
};
if (lint.length) { console.log(`■ 데이터 오류 (${lint.length})`); lint.slice(0, 20).forEach((l) => console.log("  " + l)); }
console.log(`2부 검사: ${RUNS}회 플레이, 2부 장면 ${part2.length}개 중 ${part2.length - report.unseen.length}개 등장`);
console.log("\n■ 도달률");
for (const [id, name] of Object.entries(MILESTONES)) console.log(`  ${name}: ${(((reach[id] ?? 0) / RUNS) * 100).toFixed(1)}%`);
show("길이 끊김", report.deadEnds);
show("만난 적 없는 인물", report.people);
show("같이 켜질 수 없는 표시", report.exclusive);
show("반복 아닌데 두 번", report.twice);
show("기타 끝남", report.ends);
console.log(`\n■ 한 번도 안 나온 장면 (${report.unseen.length})`);
for (const u of report.unseen) console.log("  " + u);
