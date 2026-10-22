// 플레이 화면 그리기 전담. 게임 규칙은 모른다. 글은 모두 i18n에서 꺼낸다.
// 화면에는 지금 장면 하나만 보이고, 지나온 행동은 하단 기록창에 한 줄씩 쌓인다.
// 조작: 숫자키(1~9)로 고르기, Enter로 확인, Esc로 메인.
import { lineToHtml, linesToHtml } from "./markup.js";
import { Keys } from "./keys.js";
import { CONFIG } from "../config.js";

export class GameView {
  constructor(root, config, i18n) {
    this.config = config;
    this.i = i18n;
    this.$ = (sel) => root.querySelector(sel);
    this.layer = this.$("#game");
    this.stage = this.$("#stage");
    this.logList = this.$("#log");
    this.onMenu = null;
    this.$("#toMenu").addEventListener("click", () => this.onMenu?.());
  }

  open(onMenu) {
    this.onMenu = onMenu;
    this.layer.hidden = false;
    this.$("#toMenu").hidden = false;
    this.$("#toMenu").innerHTML = `${this.i.t("game.toMenu")}<kbd>Esc</kbd>`;
    this.$("#logTitle").textContent = this.i.t("game.logTitle");
  }

  close() {
    this.layer.hidden = true;
    Keys.clear();
  }

  // 화면별 키 처리 + 공통 Esc(메인으로)
  keys(fn) {
    Keys.set((e) => {
      if (e.key === "Escape" && this.onMenu && !this.$("#toMenu").hidden) { this.onMenu(); return true; }
      return fn ? fn(e) : false;
    });
  }

  header(life, karma) {
    this.$("#karma").textContent = this.i.t("game.karma", { k: karma });
  }

  // 이번 생에서 몇 번째 장면인지 (예: 12장)
  chapter(n) {
    this.$("#life").textContent = this.i.t("game.chapter", { n });
  }

  stats(state) {
    const i = this.i;
    const rows = [`<div class="stat realm"><span>${i.stat("경지")}</span><b>${i.realm(state.stat("경지"))}</b></div>`];
    for (const s of this.config.shownStats) {
      // 체력은 숫자 대신 막대(최대 체력 대비 10칸)
      if (s === "체력") {
        const max = Math.max(1, state.stat("최대체력"));
        const n = Math.max(0, Math.min(10, Math.ceil((state.stat("체력") / max) * 10)));
        rows.push(`<div class="stat hp"><span>${i.stat(s)}</span><b class="hpbar${n <= 3 ? " low" : ""}"><i style="width:${n * 10}%"></i></b></div>`);
      } else {
        const bonus = state.gear()[s] ?? 0; // 무기 보너스는 따로 표시
        rows.push(`<div class="stat"><span>${i.stat(s)}</span><b>${state.stat(s)}${bonus ? `<small class="gear">(+${bonus})</small>` : ""}</b></div>`);
      }
    }
    this.$("#stats").innerHTML = rows.join("");
    const sit = state.situation ? `<li class="situation">${i.t(`situations.${state.situation}`)}</li>` : "";
    this.$("#items").innerHTML = sit + (state.items.length
      ? state.items.map((x) => { const d = i.itemDesc(x); return `<li>${d ? `<span class="term" tabindex="0" data-term="${i.item(x)}" data-tip="${d.replaceAll('"', "&quot;")}">${i.item(x)}</span>` : i.item(x)}</li>`; }).join("")
      : `<li class="none">${i.t("game.emptyHands")}</li>`);
  }

  // 변화 기록 하나를 글로.
  changeText(c) {
    const i = this.i;
    if (c.type === "gain") return i.t("changes.gain", { item: i.item(c.item) });
    if (c.type === "lose") return i.t("changes.lose", { item: i.item(c.item) });
    if (c.type === "loseAll") return i.t("changes.loseAll");
    if (c.type === "realm") return i.t("changes.realm", { realm: i.realm(c.value) });
    if (c.type === "set") return `${i.stat(c.stat)} ${c.value}`;
    if (c.type === "join") return i.t("changes.join", { name: i.name(c.name) });
    if (c.type === "leave") return i.t("changes.leave");
    if (c.type === "hp") return i.t(`changes.hp.${c.tier}`);
    if (c.type === "stat" && c.stat === this.config.madness?.stat) return i.t(c.delta > 0 ? "changes.madUp" : "changes.madDown");
    if (c.type === "stall") return i.t("changes.stall");
    if (c.type === "situation") return c.name === "없음" ? i.t("changes.situationEnd") : i.t("changes.situation", { name: i.t(`situations.${c.name}`) });
    if (c.type === "bond") return i.t(c.delta > 0 ? "changes.bondUp" : "changes.bondDown", { name: i.name(c.name) });
    if (c.type === "fame") return i.t(c.delta > 0 ? "changes.fameUp" : "changes.fameDown", { name: i.name(c.name) });
    const extra = c.extra ? ` <small class="trait-bonus">${i.t("changes.traitBonus", { n: c.extra.n, name: i.t(`karmaScreen.traits.${c.extra.name}.short`) })}</small>` : "";
    return `${i.stat(c.stat)} ${c.delta > 0 ? "+" : ""}${c.delta}${extra}`;
  }

  changesHtml(changes) {
    return changes.map((c) => `<span class="${c.good ? "up" : "down"}">${this.changeText(c)}</span>`).join(" ");
  }

  show(sec) {
    this.limitTerms(sec);
    this.stage.replaceChildren(sec);
    window.scrollTo({ top: 0 });
  }

  // 용어 밑줄 정리: termContext = { mode: () => "twice"|"always"|"off", counts: {} }
  // twice면 한 생에 용어마다 두 번까지만 밑줄을 남기고, 나머지는 보통 글자로 바꾼다.
  limitTerms(root) {
    const ctx = this.termContext;
    if (!ctx) return;
    const mode = ctx.mode();
    if (mode === "always") return;
    root.querySelectorAll(".term").forEach((t) => {
      const term = t.dataset.term;
      const n = ctx.counts[term] ?? 0;
      if (mode === "off" || n >= this.config.termLimit) t.replaceWith(...t.childNodes);
      else ctx.counts[term] = n + 1;
    });
  }

  // 기록창 전체를 다시 그린다 (최신이 맨 위). 기록에는 글 대신 id만 있어서 언어를 바꿔도 맞게 나온다.
  renderLog(entries) {
    const i = this.i;
    if (!entries.length) {
      this.logList.innerHTML = `<li class="empty">${i.t("game.logEmpty")}</li>`;
      return;
    }
    this.logList.innerHTML = entries
      .slice()
      .reverse()
      .map(
        (x) =>
          `<li class="${x.dead ? "dead" : ""}"><span class="t">${i.ev(x.ev, "title")}</span><span class="g">[${i.ev(x.ev, `c${x.c}.tag`)}]</span>${this.changesHtml(x.changes)}${x.dead ? `<span class="down">${i.t("game.death")}</span>` : ""}</li>`
      )
      .join("");
  }

  // 선택지 뒤에 붙는 꼬리표: 열린 이유(소지품·능력치 조건·체질)와 영향을 주는 능력치
  choiceTags(c) {
    const cond = c.condition ?? {};
    const i = this.i;
    const tags = [];
    if ((cond.items ?? []).length) tags.push(i.t("game.itemChoice"));
    for (const [k, v] of Object.entries(cond.stat_min ?? {})) tags.push(i.t("game.statChoice", { stat: i.stat(k), v }));
    const any = Object.entries(cond.stat_min_any ?? {});
    if (any.length) tags.push(any.map(([k, v]) => i.t("game.statChoice", { stat: i.stat(k), v })).join(i.t("game.or")));
    for (const [id, lv] of Object.entries(cond.traits ?? {})) {
      const tr = (this.config.traits ?? []).find((x) => x.id === id);
      const name = tr?.tiers[lv - 1]?.name ?? id;
      tags.push(i.t(`karmaScreen.traits.${name}.name`));
    }
    // 기억으로 열린 선택지는 [기억] 표시
    for (const m of this.config.memories ?? []) if ((cond.flags ?? []).includes(m.flag)) tags.push(i.t("game.memoryChoice"));
    const req = (c.madness ? ` <span class="mad">[${i.t("game.madness")}]</span>` : "") + tags.map((x) => ` <span class="req">[${x}]</span>`).join("");
    const stat = c.stat && !(cond.stat_min && c.stat in cond.stat_min) ? ` <span class="tag">[${i.stat(c.stat)}]</span>` : "";
    return req + stat;
  }

  scene(ev, choices, onConfirm, isFresh = () => false, dejavu = false) {
    const i = this.i;
    const sec = el("section", "scene");
    // 기연 장면이면 제목 위에 기연 표시 (선택지에는 힌트를 주지 않는다)
    // 본문이 길면 쪽으로 나눈다(빈 줄에서만 자름). 방향키·Enter·오른쪽 클릭·밀기로 넘기고, 마지막 쪽에서 선택지가 나온다
    const pages = splitPages(i.ev(ev.id, "desc"), CONFIG.pageChars ?? 260);
    let page = 0;
    sec.innerHTML = `${ev.fortune ? `<p class="fortune-banner">${i.t("game.fortune")}</p>` : ""}<h2 class="scene-title">${i.ev(ev.id, "title")}${pages.length > 1 ? `<span class="page-num"></span>` : ""}</h2><div class="prose page-body"></div>${pages.length > 1 ? `<button type="button" class="page-arrow page-prev" aria-label="앞 쪽"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><button type="button" class="page-arrow page-next" aria-label="다음 쪽"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>` : ""}${dejavu ? `<div class="prose dejavu">${linesToHtml(i.ev(ev.id, "dejavu"))}</div>` : ""}`;
    const body = sec.querySelector(".page-body");
    const nextBtn = sec.querySelector(".page-next");
    const prevBtn = sec.querySelector(".page-prev");
    const dj = sec.querySelector(".dejavu");
    const list = el("div", "choices");
    const lastPage = () => page === pages.length - 1;
    const drawPage = () => {
      body.innerHTML = linesToHtml(pages[page]);
      const pn = sec.querySelector(".page-num");
      if (pn) pn.textContent = `${page + 1}/${pages.length}`;
      list.hidden = !lastPage();
      if (nextBtn) nextBtn.hidden = lastPage();
      if (prevBtn) prevBtn.hidden = page === 0;
      if (dj) dj.hidden = !lastPage();
      window.scrollTo?.(0, 0);
    };
    const turn = (d) => {
      const n = page + d;
      if (n < 0 || n >= pages.length) return false;
      page = n; drawPage(); return true;
    };
    nextBtn?.addEventListener("click", () => turn(1));
    prevBtn?.addEventListener("click", () => turn(-1));
    if (pages.length > 1) {
      // 오른쪽 클릭: 다음 쪽 (마지막 쪽에서는 브라우저 메뉴 그대로)
      sec.addEventListener("contextmenu", (e) => { if (!lastPage()) { e.preventDefault(); turn(1); } });
      // 밀기(휴대폰 터치·PC 마우스 끌기): 오른쪽→왼쪽이면 다음 쪽, 반대면 앞 쪽
      let sx = null, sy = null;
      sec.addEventListener("pointerdown", (e) => { if (e.button === 0) { sx = e.clientX; sy = e.clientY; } });
      const end = (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        sx = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { turn(dx < 0 ? 1 : -1); window.getSelection?.().removeAllRanges(); }
      };
      sec.addEventListener("pointerup", end);
      sec.addEventListener("pointercancel", () => { sx = null; });
      sec.style.touchAction = "pan-y";
    }
    let picked = null;

    // 고른 선택지 박스 안에 '결정 Enter' 표시가 생기고, 그 박스를 한 번 더 누르면 결정
    const select = (n) => {
      picked = choices[n];
      list.querySelectorAll(".choice").forEach((b, j) => b.classList.toggle("picked", j === n));
    };
    const commit = () => {
      this.lastChoice = picked; // 결과 화면에서 선택지의 능력치 표시용
      this.keys(null);
      onConfirm(picked);
    };
    // 귀결(이번 생이 끝나는 결말)로 이어지는 선택지는 한 번 더 묻는다
    const go = () => {
      if (!picked) return;
      if (picked.outcomes.some((o) => o.effects?.ending)) this.confirmEnd(sec, commit, () => this.keys(sceneKeys));
      else commit();
    };

    choices.forEach((c, n) => {
      const b = el("button", "choice" + (c.warn ? " warn" : ""));
      b.type = "button";
      b.innerHTML = `<span class="num">${n + 1}</span><span class="txt">${lineToHtml(i.ev(ev.id, `c${c.id}.text`))}${this.choiceTags(c)}</span>${c.outcomes.some((o) => o.effects?.ending) ? `<span class="end-label">${i.t("game.conclude")}</span>` : ""}${isFresh(c) ? `<span class="fresh-label">${i.t("game.fresh")}</span>` : ""}${c.warn ? `<span class="warn-label">${i.t("game.warn")}</span>` : ""}<span class="go-label">${i.t("game.go")}<kbd>Enter</kbd></span>`;
      b.addEventListener("click", () => {
        if (b.dataset.held) { delete b.dataset.held; return; } // 꾹 눌러 이미 결정했다
        picked === c ? go() : select(n); // 고른 걸 한 번 더 누르면 결정 (더블클릭 포함)
      });
      holdToFire(b, b, () => { b.dataset.held = "1"; select(n); go(); }); // 꾹 누르면 게이지가 차고 바로 결정
      list.append(b);
    });
    sec.append(list);
    this.show(sec);
    drawPage();

    const sceneKeys = (e) => {
      if (e.key === "ArrowRight") { turn(1); return true; }
      if (e.key === "ArrowLeft") { turn(-1); return true; }
      if (!lastPage()) { if (e.key === "Enter" || e.key === " ") { turn(1); return true; } return false; }
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) {
        // 고른 번호를 한 번 더 꾹 누르고 있으면 결정
        if (picked === choices[n - 1]) Keys.hold(e.key, list.children[n - 1], go);
        else select(n - 1);
        return true;
      }
      if (e.key === "Enter" && picked) { go(); return true; }
      return false;
    };
    this.keys(sceneKeys);
  }

  // 결말 확인창: "이번 생은 여기서 끝난다. 정말 고르겠는가?"
  confirmEnd(host, onYes, onNo) {
    const i = this.i;
    const box = el("div", "end-confirm");
    box.setAttribute("role", "dialog");
    box.innerHTML = `<div class="end-card"><p>${i.t("game.endConfirm")}</p><div class="end-btns"><button type="button" class="yes">${i.t("game.endYes")}<kbd>Enter</kbd></button><button type="button" class="no">${i.t("game.endNo")}<kbd>Esc</kbd></button></div></div>`;
    const close = () => box.remove();
    const yes = () => { close(); onYes(); };
    const no = () => { close(); onNo(); };
    box.querySelector(".yes").addEventListener("click", yes);
    box.querySelector(".no").addEventListener("click", no);
    host.append(box);
    box.querySelector(".no").focus();
    // Esc가 메뉴로 가지 않도록 메뉴 처리보다 먼저 받는다
    Keys.set((e) => {
      if (e.key === "Enter") { yes(); return true; }
      if (e.key === "Escape") { no(); return true; }
      return true; // 창이 떠 있는 동안 다른 키는 막는다
    });
  }

  // 첫 생에만 나오는 도입 화면.
  intro(evId, onDone) {
    const sec = el("section", "intro");
    sec.innerHTML = `<div class="prose">${linesToHtml(this.i.ev(evId, "intro"))}</div>`;
    const b = button(this.i.t("game.continue"), onDone);
    sec.append(b);
    this.show(sec);
    this.keys((e) => (e.key === "Enter" ? (b.click(), true) : false));
  }

  // 결과는 새 화면으로: 장면 제목, 고른 선택 한 줄, 결과 글. textKey 예: "c2.o0"
  // textEv: 결과 글을 가져올 장면 (검은 비늘처럼 다른 장면의 결과로 바뀐 경우)
  outcome(evId, choiceId, textKey, changes, buttonKey, onNext, rare = false, fortune = false, textEv = evId, trait = null) {
    const i = this.i;
    const sec = el("section", "outcome" + (rare ? " rare" : ""));
    // trait: 결과를 바꾼 체질 id
    const traitHtml = trait ? `<div class="trait-banner"><b>${i.t("game.trait", { name: i.t(`karmaScreen.traits.${trait}.name`) })}</b><span>${i.t(`karmaScreen.traits.${trait}.fired`)}</span></div>` : "";
    sec.innerHTML = `${traitHtml}${rare ? `<p class="rare-banner">${i.t("game.rare", { n: this.config.karma.perRare })}</p>` : fortune ? `<p class="fortune-banner">${i.t("game.fortune")}</p>` : ""}<h2>${i.ev(evId, "title")}</h2>
      <p class="chosen">${lineToHtml(i.ev(evId, `c${choiceId}.text`))}${this.lastChoice ? this.choiceTags(this.lastChoice) : ""}</p>
      <div class="prose">${linesToHtml(i.ev(textEv, textKey))}</div>`;
    if (changes.length) {
      sec.innerHTML += `<ul class="changes">${changes.map((c) => `<li class="${c.good ? "up" : "down"}">${this.changeText(c)}</li>`).join("")}</ul>`;
    }
    const b = button(i.t(buttonKey), onNext);
    sec.append(b);
    this.show(sec);
    // Enter는 바로, 1~5는 꾹 누르고 있으면 넘어간다
    this.keys((e) => {
      if (e.key === "Enter") { b.click(); return true; }
      if (/^[1-5]$/.test(e.key)) { Keys.hold(e.key, b, () => b.click()); return true; }
      return false;
    });
    // 빈 곳을 꾹 누르고 있으면 '계속' 버튼의 게이지가 차고 넘어간다 (버튼·용어는 제외)
    // (꺼 둠) 빈 곳을 꾹 눌러 넘어가기: 글을 복사하려다 넘어가 버려서 막았다
    // holdToFire(sec, b, () => b.click(), undefined, (e) => !e.target.closest("button, .term, a"));
  }

  ending(kind, summary, onDone) {
    const i = this.i;
    this.$("#toMenu").hidden = true;
    const sec = el("section", "ending " + kind);
    const end = this.lastEnding;
    const head = kind === "death" ? i.t("ending.deathHead") : kind === "ending" ? i.t(`endings.${end}.head`) : i.t("ending.endHead");
    const sub = kind === "death" ? "" : kind === "ending" ? `<p class="note">${i.t(`endings.${end}.note`)}</p>` : `<p class="note">${i.t("ending.endNote")}</p>`;
    sec.innerHTML = `<h2>${head}</h2>${sub}
      <dl class="karma">${summary.parts.filter((p) => p.value > 0 || ["scenes", "fresh"].includes(p.id)).map((p) => `<div class="part-${p.id}"><dt>${i.t(`ending.${p.id}`, { w: p.note ?? 0 })}</dt><dd>+${p.value}</dd></div>`).join("")}
      ${summary.mult > 1 ? `<div class="part-mult"><dt>${i.t("ending.mult")}</dt><dd>×${summary.mult.toFixed(2)}</dd></div>` : ""}
      <div class="total"><dt>${i.t("ending.total")}</dt><dd>+${summary.total}</dd></div></dl>
      ${summary.newAch.length ? `<p class="ach">${i.t("ending.newAch", { list: summary.newAch.map((a) => i.ach(a, "name")).join(", ") })}</p>` : ""}
      ${(summary.newMemories ?? []).map((m) => `<p class="memory">${i.t("ending.newMemory", { name: i.t(`karmaScreen.memories.${m}.name`) })}</p>`).join("")}`;
    const b = button(i.t("game.toMain"), onDone);
    sec.append(b);
    this.show(sec);
    this.keys((e) => (e.key === "Enter" ? (b.click(), true) : false));
  }
}

export function button(text, onClick, cls = "next") {
  const b = el("button", cls);
  b.type = "button";
  b.innerHTML = `${text}<kbd>Enter</kbd>`;
  b.addEventListener("click", () => { if (b.disabled) return; b.disabled = true; onClick(); });
  return b;
}

// 꾹 누르기: ms 동안 누르고 있으면 onFire. gauge 요소에 holding 클래스를 붙여 CSS로 게이지를 채운다.
// 손을 떼거나, 밖으로 나가거나, 스크롤하면 취소된다.
export function holdToFire(area, gauge, onFire, ms = 650, accept = () => true) {
  let timer = null;
  const cancel = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    gauge.classList.remove("holding");
  };
  area.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !accept(e)) return;
    cancel();
    gauge.style.setProperty("--hold", `${ms}ms`);
    gauge.classList.add("holding");
    timer = setTimeout(() => {
      timer = null;
      gauge.classList.remove("holding");
      onFire();
    }, ms);
  });
  for (const t of ["pointerup", "pointerleave", "pointercancel"]) area.addEventListener(t, cancel);
  area.addEventListener("contextmenu", (e) => { if (timer) e.preventDefault(); }); // 휴대폰 길게 누르기 메뉴 막기
}

export function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

// 본문 줄들을 쪽으로 나눈다. 빈 줄(문단 경계)에서만 자르고, 한 쪽은 대략 limit 글자.
export function splitPages(lines, limit) {
  const len = (l) => String(l).replace(/\*\*|<[^>]+>|[{}]/g, "").length;
  const pages = [];
  let cur = [], n = 0;
  const paras = [];
  let buf = [];
  for (const l of lines) { if (l === "") { if (buf.length) paras.push(buf); buf = []; } else buf.push(l); }
  if (buf.length) paras.push(buf);
  for (const p of paras) {
    const pl = p.reduce((a, l) => a + len(l), 0);
    if (cur.length && n + pl > limit) { pages.push(cur); cur = []; n = 0; }
    cur.push(...(cur.length ? ["", ...p] : p)); n += pl;
  }
  if (cur.length) pages.push(cur);
  // 마지막 쪽이 너무 짧으면 앞 쪽에 붙인다
  if (pages.length > 1 && pages.at(-1).reduce((a, l) => a + len(l), 0) < limit * 0.25) { const last = pages.pop(); pages[pages.length - 1].push("", ...last); }
  return pages.length ? pages : [lines];
}
