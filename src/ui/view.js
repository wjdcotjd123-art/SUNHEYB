// 플레이 화면 그리기 전담. 게임 규칙은 모른다. 글은 모두 i18n에서 꺼낸다.
// 화면에는 지금 장면 하나만 보이고, 지나온 행동은 하단 기록창에 한 줄씩 쌓인다.
// 조작: 숫자키(1~9)로 고르기, Enter로 확인, Esc로 메인.
import { lineToHtml, linesToHtml } from "./markup.js";
import { Keys } from "./keys.js";

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
    this.$("#life").textContent = this.i.t("game.life", { n: life });
    this.$("#karma").textContent = this.i.t("game.karma", { k: karma });
  }

  stats(state) {
    const i = this.i;
    const rows = [`<div class="stat realm"><span>${i.stat("경지")}</span><b>${i.realm(state.stat("경지"))}</b></div>`];
    for (const s of this.config.shownStats) rows.push(`<div class="stat"><span>${i.stat(s)}</span><b>${state.stat(s)}</b></div>`);
    this.$("#stats").innerHTML = rows.join("");
    this.$("#items").innerHTML = state.items.length
      ? state.items.map((x) => `<li>${i.gloss(i.item(x)) ? `<span class="term" tabindex="0" data-term="${i.item(x)}">${i.item(x)}</span>` : i.item(x)}</li>`).join("")
      : `<li class="none">${i.t("game.emptyHands")}</li>`;
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
    if (c.type === "bond") return i.t(c.delta > 0 ? "changes.bondUp" : "changes.bondDown", { name: i.name(c.name) });
    if (c.type === "fame") return i.t(c.delta > 0 ? "changes.fameUp" : "changes.fameDown", { name: i.name(c.name) });
    return `${i.stat(c.stat)} ${c.delta > 0 ? "+" : ""}${c.delta}`;
  }

  changesHtml(changes) {
    return changes.map((c) => `<span class="${c.good ? "up" : "down"}">${this.changeText(c)}</span>`).join(" ");
  }

  show(sec) {
    this.stage.replaceChildren(sec);
    window.scrollTo({ top: 0 });
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

  scene(ev, choices, onConfirm) {
    const i = this.i;
    const sec = el("section", "scene");
    // 기연 장면이면 제목 위에 기연 표시 (선택지에는 힌트를 주지 않는다)
    sec.innerHTML = `${ev.fortune ? `<p class="fortune-banner">${i.t("game.fortune")}</p>` : ""}<h2>${i.ev(ev.id, "title")}</h2><div class="prose">${linesToHtml(i.ev(ev.id, "desc"))}</div>`;
    const list = el("div", "choices");
    const confirm = button(i.t("game.next"), () => go());
    confirm.hidden = true;
    let picked = null;

    const select = (n) => {
      picked = choices[n];
      list.querySelectorAll(".choice").forEach((b, j) => b.classList.toggle("picked", j === n));
      confirm.hidden = false;
    };
    const go = () => {
      if (!picked) return;
      this.keys(null);
      onConfirm(picked);
    };

    choices.forEach((c, n) => {
      const b = el("button", "choice" + (c.warn ? " warn" : ""));
      b.type = "button";
      b.innerHTML = `<span class="num">${n + 1}</span><span class="tag">[${i.ev(ev.id, `c${c.id}.tag`)}]</span><span class="txt">${lineToHtml(i.ev(ev.id, `c${c.id}.text`))}</span>${c.warn ? `<span class="warn-label">${i.t("game.warn")}</span>` : ""}`;
      b.addEventListener("click", () => select(n));
      list.append(b);
    });
    sec.append(list, confirm);
    this.show(sec);

    this.keys((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) { select(n - 1); return true; }
      if (e.key === "Enter" && picked) { go(); return true; }
      return false;
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
  outcome(evId, choiceId, textKey, changes, buttonKey, onNext, rare = false, fortune = false, textEv = evId) {
    const i = this.i;
    const sec = el("section", "outcome" + (rare ? " rare" : ""));
    sec.innerHTML = `${rare ? `<p class="rare-banner">${i.t("game.rare", { n: this.config.karma.perRare })}</p>` : fortune ? `<p class="fortune-banner">${i.t("game.fortune")}</p>` : ""}<h2>${i.ev(evId, "title")}</h2>
      <p class="chosen"><span class="tag">[${i.ev(evId, `c${choiceId}.tag`)}]</span> ${lineToHtml(i.ev(evId, `c${choiceId}.text`))}</p>
      <div class="prose">${linesToHtml(i.ev(textEv, textKey))}</div>`;
    if (changes.length) {
      sec.innerHTML += `<ul class="changes">${changes.map((c) => `<li class="${c.good ? "up" : "down"}">${this.changeText(c)}</li>`).join("")}</ul>`;
    }
    const b = button(i.t(buttonKey), onNext);
    sec.append(b);
    this.show(sec);
    this.keys((e) => (e.key === "Enter" ? (b.click(), true) : false));
  }

  ending(kind, summary, onDone) {
    const i = this.i;
    this.$("#toMenu").hidden = true;
    const sec = el("section", "ending " + kind);
    const head = kind === "death" ? i.t("ending.deathHead") : i.t("ending.endHead");
    const sub = kind === "death" ? "" : `<p class="note">${i.t("ending.endNote")}</p>`;
    sec.innerHTML = `<h2>${head}</h2>${sub}
      <dl class="karma">${summary.parts.filter((p) => p.value > 0 || ["scenes", "fresh"].includes(p.id)).map((p) => `<div class="part-${p.id}"><dt>${i.t(`ending.${p.id}`, { w: p.note ?? 0 })}</dt><dd>+${p.value}</dd></div>`).join("")}
      <div class="total"><dt>${i.t("ending.total")}</dt><dd>+${summary.total}</dd></div></dl>
      ${summary.newAch.length ? `<p class="ach">${i.t("ending.newAch", { list: summary.newAch.map((a) => i.ach(a, "name")).join(", ") })}</p>` : ""}`;
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

export function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
