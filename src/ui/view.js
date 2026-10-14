// 화면 그리기 전담. 게임 규칙은 모른다.
// 화면에는 지금 장면 하나만 보이고, 지나온 행동은 하단 기록창에 한 줄씩 쌓인다.
// 조작: 숫자키(1~9)로 고르기, Enter로 확인.
import { linesToHtml } from "./markup.js";
import { nice } from "../events/resolver.js";

export class GameView {
  constructor(root, config) {
    this.config = config;
    this.$ = (sel) => root.querySelector(sel);
    this.stage = this.$("#stage");
    this.logList = this.$("#log");
    this.onKey = null; // 지금 화면의 키 처리
    root.addEventListener("keydown", (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      if (this.onKey?.(e)) e.preventDefault();
    });
  }

  header(life, karma) {
    this.$("#life").textContent = `제 ${life} 생`;
    this.$("#karma").textContent = `업 ${karma}`;
  }

  stats(state) {
    const realm = this.config.realmNames[state.stat("경지")] ?? "?";
    const rows = [`<div class="stat realm"><span>경지</span><b>${realm}</b></div>`];
    for (const s of this.config.shownStats) rows.push(`<div class="stat"><span>${s}</span><b>${state.stat(s)}</b></div>`);
    this.$("#stats").innerHTML = rows.join("");
    this.$("#items").innerHTML = state.items.length
      ? state.items.map((i) => `<li>${nice(i)}</li>`).join("")
      : `<li class="none">빈손</li>`;
  }

  // 새 화면으로 갈아끼운다.
  show(sec) {
    this.stage.replaceChildren(sec);
    window.scrollTo({ top: 0 });
  }

  clearLog() {
    this.logList.replaceChildren();
  }

  // 기록창에 한 줄 추가 (최신이 맨 위).
  log(title, tag, changes, dead) {
    const li = el("li", dead ? "dead" : "");
    const ch = changes.map((c) => `<span class="${c.good ? "up" : "down"}">${c.text}</span>`).join(" ");
    li.innerHTML = `<span class="t">${title}</span><span class="g">[${tag}]</span>${ch}${dead ? `<span class="down">죽음</span>` : ""}`;
    this.logList.prepend(li);
  }

  scene(ev, choices, onConfirm) {
    const sec = el("section", "scene");
    sec.innerHTML = `<h2>${ev.title}</h2><div class="prose">${linesToHtml(ev.description)}</div>`;
    const list = el("div", "choices");
    const confirm = this.button("다음", () => go());
    confirm.hidden = true;
    let picked = null;

    const select = (i) => {
      picked = choices[i];
      list.querySelectorAll(".choice").forEach((b, j) => b.classList.toggle("picked", j === i));
      confirm.hidden = false;
    };
    const go = () => {
      if (!picked) return;
      this.onKey = null;
      list.querySelectorAll(".choice").forEach((b) => { b.disabled = true; if (!b.classList.contains("picked")) b.classList.add("dim"); });
      confirm.remove();
      onConfirm(picked, sec);
    };

    choices.forEach((c, i) => {
      const b = el("button", "choice" + (c.condition ? " earned" : ""));
      b.type = "button";
      b.innerHTML = `<span class="num">${i + 1}</span><span class="tag">[${c.tag}]</span><span class="txt">${c.text}</span>`;
      b.addEventListener("click", () => select(i));
      list.append(b);
    });
    sec.append(list, confirm);
    this.show(sec);

    this.onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) { select(n - 1); return true; }
      if (e.key === "Enter" && picked) { go(); return true; }
      return false;
    };
  }

  // 결과는 같은 화면, 고른 항목 아래에 붙는다.
  outcome(sec, outcome, changes, buttonText, onNext) {
    const out = el("div", "outcome");
    out.innerHTML = `<div class="prose">${linesToHtml(outcome.text)}</div>`;
    if (changes.length) {
      out.innerHTML += `<ul class="changes">${changes.map((c) => `<li class="${c.good ? "up" : "down"}">${c.text}</li>`).join("")}</ul>`;
    }
    const b = this.button(buttonText, () => { this.onKey = null; onNext(); });
    out.append(b);
    sec.append(out);
    out.scrollIntoView({ block: "start", behavior: "smooth" });
    this.onKey = (e) => (e.key === "Enter" ? (b.click(), true) : false);
  }

  ending(kind, summary, onRestart) {
    const sec = el("section", "ending " + kind);
    const head = kind === "death" ? "이번 생은 여기서 끝났다." : "길이 여기서 끊겨 있다.";
    const sub = kind === "death" ? "" : `<p class="note">시험판에 들어 있는 장면을 모두 지나왔다.</p>`;
    sec.innerHTML = `<h2>${head}</h2>${sub}
      <dl class="karma">${summary.parts.map((p) => `<div><dt>${p.label}</dt><dd>+${p.value}</dd></div>`).join("")}
      <div class="total"><dt>얻은 업</dt><dd>+${summary.total}</dd></div></dl>
      ${summary.newAch.length ? `<p class="ach">인과록에 새겨짐 · ${summary.newAch.map(nice).join(", ")}</p>` : ""}`;
    const b = this.button("다음 생으로", () => { this.onKey = null; onRestart(); });
    sec.append(b);
    this.show(sec);
    this.onKey = (e) => (e.key === "Enter" ? (b.click(), true) : false);
  }

  button(text, onClick) {
    const b = el("button", "next");
    b.type = "button";
    b.innerHTML = `${text}<kbd>Enter</kbd>`;
    b.addEventListener("click", () => { if (b.disabled) return; b.disabled = true; onClick(); });
    return b;
  }
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
