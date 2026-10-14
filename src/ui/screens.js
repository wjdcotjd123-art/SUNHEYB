// 메인 화면과 그 하위 화면(인과록, 업, 설정). 게임 규칙은 모른다. 글은 모두 i18n에서 꺼낸다.
// 조작: 메인에서는 숫자키로 바로 이동, 하위 화면은 Esc로 돌아가기.
import { Keys } from "./keys.js";
import { el } from "./view.js";
import { FONT_SIZES } from "../meta/settings.js";

export class MenuScreens {
  constructor(root, i18n) {
    this.layer = root.querySelector("#screen");
    this.i = i18n;
  }

  hide() {
    this.layer.hidden = true;
  }

  show(sec, onBack) {
    this.layer.hidden = false;
    this.layer.replaceChildren(sec);
    window.scrollTo({ top: 0 });
    if (onBack) {
      const back = el("button", "back");
      back.type = "button";
      back.innerHTML = `${this.i.t("common.back")}<kbd>Esc</kbd>`;
      back.addEventListener("click", onBack);
      sec.prepend(back);
      Keys.set((e) => (e.key === "Escape" ? (onBack(), true) : false));
    }
  }

  // info: { lives, karma, hasSave }, h: { continue, newLife, achievements, karma, settings }
  main(info, h) {
    const t = (k, v) => this.i.t(k, v);
    const sec = el("section", "menu");
    sec.innerHTML = `
      <div class="mast">
        <p class="eyebrow">${t("menu.eyebrow")}</p>
        <h1>${t("menu.title")}</h1>
        <p class="sub">${info.lives ? t("menu.livesLine", { n: `<b>${info.lives}</b>`, k: `<b>${info.karma}</b>` }) : t("menu.noLives")}</p>
      </div>`;
    const items = [
      { key: "continue", run: h.continue, off: !info.hasSave, note: info.hasSave ? "" : t("menu.noSave") },
      { key: "newLife", run: h.newLife, note: info.hasSave ? t("menu.loseSave") : "" },
      { key: "achievements", run: h.achievements },
      { key: "karma", run: h.karma },
      { key: "settings", run: h.settings },
    ];
    const nav = el("nav", "menu-list");
    let armed = false; // 새로 하기 두 번 확인용
    items.forEach((it, n) => {
      const b = el("button", "menu-item");
      b.type = "button";
      b.disabled = !!it.off;
      b.innerHTML = `<span class="num">${n + 1}</span><span class="lbl">${t("menu." + it.key)}</span>${it.note ? `<span class="mnote">${it.note}</span>` : ""}`;
      b.addEventListener("click", () => {
        if (it.key === "newLife" && info.hasSave && !armed) {
          armed = true;
          b.classList.add("armed");
          b.querySelector(".mnote").textContent = t("menu.confirmNew");
          return;
        }
        it.run();
      });
      nav.append(b);
    });
    sec.append(nav);
    this.show(sec);
    Keys.set((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= items.length && !items[n - 1].off) { nav.children[n - 1].click(); return true; }
      if (e.key === "Enter" && !items[0].off) { nav.children[0].click(); return true; }
      return false;
    });
  }

  // 분류 탭(전체 + 지역·모임별). 달성한 것은 이름·설명·달성 조건, 못 한 것은 힌트만.
  achievements(list, unlocked, outcomeCount, onBack) {
    const i = this.i;
    const sec = el("section", "sub-screen");
    const got = list.filter((a) => unlocked.includes(a.id)).length;
    const cats = Object.keys(i.t("achievementsScreen.categories")).filter((c) => list.some((a) => a.category === c));
    const tabs = [{ id: "*", label: i.t("achievementsScreen.all"), items: list }].concat(
      cats.map((c) => ({ id: c, label: i.t(`achievementsScreen.categories.${c}`), items: list.filter((a) => a.category === c) }))
    );
    sec.innerHTML = `
      <h2>${i.t("achievementsScreen.title")}</h2>
      <p class="sub">${i.t("achievementsScreen.sub", { got: `<b>${got}</b>`, all: list.length, n: `<b>${outcomeCount}</b>` })}</p>
      <div class="tabs" role="tablist"></div>
      <ul class="ach-list"></ul>`;
    const bar = sec.querySelector(".tabs");
    const ul = sec.querySelector(".ach-list");
    const render = (tab) => {
      bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === tab.id));
      ul.innerHTML = tab.items
        .map((a) =>
          unlocked.includes(a.id)
            ? `<li class="on"><b>${i.ach(a.id, "name")}</b><span>${i.ach(a.id, "desc")}</span><span class="cond">${i.t("achievementsScreen.condLabel")} · ${i.ach(a.id, "cond")}</span></li>`
            : `<li><b>${i.t("achievementsScreen.locked")}</b><span>${i.ach(a.id, "hint")}</span></li>`
        )
        .join("");
    };
    tabs.forEach((tab) => {
      const b = el("button", "tab");
      b.type = "button";
      b.id = `tab-${tab.id === "*" ? "all" : tab.id}`;
      b.dataset.id = tab.id;
      b.setAttribute("role", "tab");
      const n = tab.items.filter((a) => unlocked.includes(a.id)).length;
      b.innerHTML = `${tab.label}<small>${n}/${tab.items.length}</small>`;
      b.addEventListener("click", () => render(tab));
      bar.append(b);
    });
    render(tabs[0]);
    this.show(sec, onBack);
  }

  karma(total, onBack) {
    const t = (k) => this.i.t(k);
    const sec = el("section", "sub-screen");
    sec.innerHTML = `
      <h2>${t("karmaScreen.title")}</h2>
      <p class="big">${total}</p>
      <p class="sub">${t("karmaScreen.sub")}</p>
      <p class="empty">${t("karmaScreen.empty")}</p>`;
    this.show(sec, onBack);
  }

  // current: 설정값, languages: [{id, name}], h: { fontSize, language, wipe }
  settings(current, languages, h, onBack) {
    const t = (k) => this.i.t(k);
    const sec = el("section", "sub-screen");
    sec.innerHTML = `<h2>${t("settings.title")}</h2>
      <div class="set-row"><span class="set-lbl">${t("settings.fontSize")}</span><div class="seg" id="seg-fs" role="group"></div></div>
      ${languages.length > 1 ? `<div class="set-row"><span class="set-lbl">${t("settings.language")}</span><div class="seg" id="seg-lang" role="group"></div></div>` : ""}
      <div class="set-row danger"><span class="set-lbl">${t("settings.wipe")}</span><p class="set-note">${t("settings.wipeNote")}</p></div>`;
    segment(sec.querySelector("#seg-fs"), FONT_SIZES.map((f) => ({ id: f.id, label: t(`settings.sizes.${f.id}`) })), current.fontSize, "fs", h.fontSize);
    const langSeg = sec.querySelector("#seg-lang");
    if (langSeg) segment(langSeg, languages.map((l) => ({ id: l.id, label: l.name })), current.language, "lang", h.language);

    const wipe = el("button", "wipe");
    wipe.type = "button";
    wipe.id = "wipe";
    wipe.textContent = t("settings.wipeBtn");
    let armed = false;
    wipe.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        wipe.textContent = t("settings.wipeConfirm");
        wipe.classList.add("armed");
        return;
      }
      h.wipe();
      wipe.textContent = t("settings.wiped");
      wipe.disabled = true;
    });
    sec.querySelector(".danger").append(wipe);
    this.show(sec, onBack);
  }
}

function segment(box, options, currentId, prefix, onPick) {
  options.forEach((o) => {
    const b = el("button", "seg-btn" + (o.id === currentId ? " on" : ""));
    b.type = "button";
    b.id = `${prefix}-${o.id}`;
    b.textContent = o.label;
    b.addEventListener("click", () => {
      box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      onPick(o.id);
    });
    box.append(b);
  });
}
