// 화면 그리기 전담. 게임 규칙은 모른다.
import { linesToHtml } from "./markup.js";
import { nice } from "../events/resolver.js";

export class GameView {
  constructor(root, config) {
    this.config = config;
    this.$ = (sel) => root.querySelector(sel);
    this.stage = this.$("#stage");
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

  clear() {
    this.stage.innerHTML = "";
  }

  scene(ev, choices, onPick) {
    const sec = el("section", "scene");
    sec.innerHTML = `<h2>${ev.title}</h2><div class="prose">${linesToHtml(ev.description)}</div>`;
    const list = el("div", "choices");
    choices.forEach((c) => {
      const b = el("button", "choice" + (c.condition ? " earned" : ""));
      b.type = "button";
      b.innerHTML = `<span class="tag">[${c.tag}]</span><span>${c.text}</span>`;
      b.addEventListener("click", () => {
        list.querySelectorAll("button").forEach((x) => (x.disabled = true));
        b.classList.add("picked");
        list.querySelectorAll("button:not(.picked)").forEach((x) => x.classList.add("dim"));
        onPick(c);
      });
      list.append(b);
    });
    sec.append(list);
    this.stage.append(sec);
    list.querySelector("button")?.focus({ preventScroll: true });
    sec.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  outcome(outcome, changes, buttonText, onNext) {
    const sec = el("section", "outcome");
    sec.innerHTML = `<div class="prose">${linesToHtml(outcome.text)}</div>`;
    if (changes.length) {
      sec.innerHTML += `<ul class="changes">${changes.map((c) => `<li class="${c.good ? "up" : "down"}">${c.text}</li>`).join("")}</ul>`;
    }
    sec.append(this.button(buttonText, onNext));
    this.stage.append(sec);
    sec.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  ending(kind, summary, onRestart) {
    const sec = el("section", "ending " + kind);
    const head = kind === "death" ? "이번 생은 여기서 끝났다." : "길이 여기서 끊겨 있다.";
    const sub = kind === "death" ? "" : `<p class="note">시험판에 들어 있는 장면을 모두 지나왔다.</p>`;
    sec.innerHTML = `<h2>${head}</h2>${sub}
      <dl class="karma">${summary.parts.map((p) => `<div><dt>${p.label}</dt><dd>+${p.value}</dd></div>`).join("")}
      <div class="total"><dt>얻은 업</dt><dd>+${summary.total}</dd></div></dl>
      ${summary.newAch.length ? `<p class="ach">인과록에 새겨짐 · ${summary.newAch.map(nice).join(", ")}</p>` : ""}`;
    sec.append(this.button("다음 생으로", onRestart));
    this.stage.append(sec);
    sec.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  button(text, onClick) {
    const b = el("button", "next");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", () => { b.disabled = true; onClick(); }, { once: true });
    setTimeout(() => b.focus({ preventScroll: true }), 0);
    return b;
  }
}

function el(tag, cls) {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
