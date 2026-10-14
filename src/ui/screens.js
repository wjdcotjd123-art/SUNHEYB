// 메인 화면과 그 하위 화면(인과록, 업, 설정). 게임 규칙은 모른다. 글은 모두 i18n에서 꺼낸다.
// 조작: 메인에서는 숫자키로 바로 이동, 하위 화면은 Esc로 돌아가기.
import { Keys } from "./keys.js";
import { el } from "./view.js";
import { FONT_SIZES, TERM_MODES } from "../meta/settings.js";

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

  // 인과록: 인물 / 무공 / 집단 / 물건 / 업적 탭.
  // 도감 항목은 단계마다 req 중 하나라도 겪었으면 열린다(모든 생 누적). 첫 단계 전에는 이름도 ???.
  codex(sections, achList, record, onBack, startTab = "people") {
    const i = this.i;
    const sec = el("section", "sub-screen codex");
    const unlocked = record.data.achievements;
    const opened = (st) => st.req.some((r) => record.knows(r));
    const tabs = sections.map((s) => s.id).concat("achievements");
    const countOf = (id) => {
      if (id === "achievements") return [achList.filter((a) => unlocked.includes(a.id)).length, achList.length];
      const es = sections.find((s) => s.id === id).entries;
      return [es.filter((e) => opened(e.stages[0])).length, es.length];
    };
    sec.innerHTML = `<h2>${i.t("achievementsScreen.title")}</h2><div class="tabs main-tabs" role="tablist"></div><div class="codex-body"></div>`;
    const bar = sec.querySelector(".main-tabs");
    const body = sec.querySelector(".codex-body");

    const renderEntries = (id) => {
      const es = sections.find((s) => s.id === id).entries;
      body.innerHTML = `<ul class="ach-list codex-list">${es
        .map((e) => {
          const open = e.stages.filter(opened);
          if (!open.length || !opened(e.stages[0])) return `<li><b>${i.t("codex.unknown")}</b></li>`;
          const lines = e.stages.map((st, n) => (opened(st) ? `<span>${i.codex(e.id, `s${n}`)}</span>` : "")).join("");
          const more = open.length < e.stages.length ? `<span class="more">${i.t("codex.more")}</span>` : "";
          return `<li class="on"><b>${i.codex(e.id, "name")}</b>${lines}${more}</li>`;
        })
        .join("")}</ul>`;
    };
    const renderAch = () => {
      body.innerHTML = `<p class="sub">${i.t("achievementsScreen.sub", { got: `<b>${unlocked.filter((a) => achList.some((x) => x.id === a)).length}</b>`, all: achList.length, n: `<b>${record.data.outcomes.length}</b>` })}</p><div class="tabs sub-tabs" role="tablist"></div><ul class="ach-list"></ul>`;
      const sbar = body.querySelector(".sub-tabs");
      const ul = body.querySelector(".ach-list");
      const cats = Object.keys(i.t("achievementsScreen.categories")).filter((c) => achList.some((a) => a.category === c));
      const stabs = [{ id: "*", label: i.t("achievementsScreen.all"), items: achList }].concat(
        cats.map((c) => ({ id: c, label: i.t(`achievementsScreen.categories.${c}`), items: achList.filter((a) => a.category === c) }))
      );
      const draw = (tab) => {
        sbar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === tab.id));
        ul.innerHTML = tab.items
          .map((a) =>
            unlocked.includes(a.id)
              ? `<li class="on"><b>${i.ach(a.id, "name")}</b><span>${i.ach(a.id, "desc")}</span><span class="cond">${i.t("achievementsScreen.condLabel")} · ${i.ach(a.id, "cond")}</span></li>`
              : `<li><b>${i.t("achievementsScreen.locked")}</b><span>${i.ach(a.id, "hint")}</span></li>`
          )
          .join("");
      };
      stabs.forEach((tab) => {
        const b = el("button", "tab");
        b.type = "button";
        b.id = `tab-${tab.id === "*" ? "all" : tab.id}`;
        b.dataset.id = tab.id;
        const n = tab.items.filter((a) => unlocked.includes(a.id)).length;
        b.innerHTML = `${tab.label}<small>${n}/${tab.items.length}</small>`;
        b.addEventListener("click", () => draw(tab));
        sbar.append(b);
      });
      draw(stabs[0]);
    };
    const select = (id) => {
      bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === id));
      id === "achievements" ? renderAch() : renderEntries(id);
    };
    tabs.forEach((id) => {
      const b = el("button", "tab");
      b.type = "button";
      b.id = `codex-${id}`;
      b.dataset.id = id;
      const [got, all] = countOf(id);
      b.innerHTML = `${i.t(`codex.sections.${id}`)}<small>${got}/${all}</small>`;
      b.addEventListener("click", () => select(id));
      bar.append(b);
    });
    select(startTab);
    this.show(sec, onBack);
  }

  // 업 상점. shop: KarmaShop, onBuy(id)
  karma(total, shop, onBuy, onBack, tr) {
    const t = (k, v) => this.i.t(k, v);
    const sec = el("section", "sub-screen");
    sec.innerHTML = `
      <h2>${t("karmaScreen.title")}</h2>
      <p class="big">${total}</p>
      <p class="sub">${t("karmaScreen.sub")}</p>
      <h3 class="shop-title">${t("karmaScreen.shopTitle")}</h3>
      <ul class="shop"></ul>
      <h3 class="shop-title">${t("karmaScreen.traitTitle")}</h3>
      <ul class="shop traits"></ul>`;
    const ul = sec.querySelector(".shop");
    shop.items.forEach((it, n) => {
      const lv = shop.level(it.id);
      const price = shop.price(it.id);
      const max = shop.isMax(it.id);
      const li = el("li", "shop-row");
      li.innerHTML = `<div class="shop-info"><b>${t(`karmaScreen.items.${it.id}.name`)}</b><span>${t(`karmaScreen.items.${it.id}.desc`)}</span><span class="shop-lv">${t("karmaScreen.level", { v: lv * it.amount })}</span></div>`;
      const b = el("button", "shop-buy");
      b.type = "button";
      b.id = `buy-${n}`;
      b.textContent = max ? t("karmaScreen.max") : t("karmaScreen.buy", { p: price });
      b.disabled = max || total < price;
      b.addEventListener("click", () => onBuy(it.id));
      li.append(b);
      ul.append(li);
    });
    const tl = sec.querySelector(".traits");
    shop.traits.forEach((it, n) => {
      const lv = shop.traitLevel(it.id);
      const on = shop.traitOn(it.id);
      const tier = shop.tierOf(it);
      const next = shop.nextTier(it);
      const li = el("li", "shop-row");
      const state = lv ? `<span class="shop-lv">${t(on ? "karmaScreen.traitOn" : "karmaScreen.traitOff")}</span>` : "";
      const up = lv && next ? `<span>${t("karmaScreen.nextTier", { name: t(`karmaScreen.traits.${next.name}.name`), desc: t(`karmaScreen.traits.${next.name}.desc`) })}</span>` : "";
      li.innerHTML = `<div class="shop-info"><b>${t(`karmaScreen.traits.${tier.name}.name`)}</b><span>${t(`karmaScreen.traits.${tier.name}.desc`)}</span>${up}${state}</div>`;
      const box = el("div", "shop-btns");
      if (lv) {
        const tg = el("button", "shop-buy");
        tg.type = "button";
        tg.id = `trait-${n}-toggle`;
        tg.textContent = t(on ? "karmaScreen.turnOff" : "karmaScreen.turnOn");
        tg.addEventListener("click", () => tr.toggle(it.id));
        box.append(tg);
      }
      if (next) {
        const b = el("button", "shop-buy");
        b.type = "button";
        b.id = `trait-${n}`;
        b.textContent = t(lv ? "karmaScreen.upgrade" : "karmaScreen.buy", { p: next.price });
        b.disabled = total < next.price;
        b.addEventListener("click", () => tr.buy(it.id));
        box.append(b);
      }
      li.append(box);
      tl.append(li);
    });
    this.show(sec, onBack);
  }

  // current: 설정값, languages: [{id, name}], h: { fontSize, language, wipe }
  settings(current, languages, h, onBack) {
    const t = (k) => this.i.t(k);
    const sec = el("section", "sub-screen");
    sec.innerHTML = `<h2>${t("settings.title")}</h2>
      <div class="set-row"><span class="set-lbl">${t("settings.fontSize")}</span><div class="seg" id="seg-fs" role="group"></div></div>
      <div class="set-row"><span class="set-lbl">${t("settings.termMode")}</span><p class="set-note">${t("settings.termNote")}</p><div class="seg" id="seg-term" role="group"></div></div>
      ${languages.length > 1 ? `<div class="set-row"><span class="set-lbl">${t("settings.language")}</span><div class="seg" id="seg-lang" role="group"></div></div>` : ""}
      <div class="set-row danger"><span class="set-lbl">${t("settings.wipe")}</span><p class="set-note">${t("settings.wipeNote")}</p></div>`;
    segment(sec.querySelector("#seg-fs"), FONT_SIZES.map((f) => ({ id: f.id, label: t(`settings.sizes.${f.id}`) })), current.fontSize, "fs", h.fontSize);
    segment(sec.querySelector("#seg-term"), TERM_MODES.map((m) => ({ id: m, label: t(`settings.termModes.${m}`) })), current.termMode ?? "twice", "term", h.termMode);
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
