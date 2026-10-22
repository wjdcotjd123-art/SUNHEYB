// 메인 화면과 그 하위 화면(인과록, 업, 설정). 게임 규칙은 모른다. 글은 모두 i18n에서 꺼낸다.
// 조작: 메인에서는 숫자키로 바로 이동, 하위 화면은 Esc로 돌아가기.
import { Keys } from "./keys.js";
import { el } from "./view.js";
import { FONT_SIZES, TERM_MODES } from "../meta/settings.js";
import { SOUND_LEVELS } from "../audio/sound.js";

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

  // 이어서 하기 옆에 흐리게: "12장 · 노인의 전각"
  whereNote(w) {
    if (!w) return "";
    const title = w.eventId ? this.i.ev(w.eventId, "title") : "";
    const ch = this.i.t("game.chapter", { n: w.chapter });
    return title && title !== `${w.eventId}.title` ? `${ch} · ${title}` : ch;
  }

  // info: { lives, karma, hasSave, where }, h: { continue, newLife, achievements, karma, settings }
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
      { key: "continue", run: h.continue, off: !info.hasSave, note: info.hasSave ? this.whereNote(info.where) : t("menu.noSave") },
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
    // 숫자 키로 고른 항목을 기억해 두고, 엔터는 그 항목을 누른다(처음엔 1번)
    let sel = items.findIndex((it) => !it.off);
    Keys.set((e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= items.length && !items[n - 1].off) { sel = n - 1; nav.children[sel].focus(); nav.children[sel].click(); return true; }
      if (e.key === "Enter" && sel >= 0) { nav.children[sel].click(); return true; }
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

    // 탭 안에서 카테고리별로 나눠 보기 (전체 + 카테고리 하위 탭)
    const renderEntries = (id) => {
      const secData = sections.find((s) => s.id === id);
      // 아직 하나도 열리지 않은 갈래는 이름부터 감춘다 (모르는 세력·장소가 미리 드러나지 않게)
      const cats = (secData.categories ?? []).filter((c) => secData.entries.some((e) => e.category === c && opened(e.stages[0])));
      body.innerHTML = `<div class="tabs sub-tabs" role="tablist"></div><div class="codex-cat"></div>`;
      const sbar = body.querySelector(".sub-tabs");
      const stabs = [{ id: "*", label: i.t("achievementsScreen.all"), items: secData.entries }].concat(
        cats.map((c) => ({ id: c, label: i.t(`codex.categories.${id}.${c}`), items: secData.entries.filter((e) => e.category === c) }))
      );
      stabs.forEach((tab) => {
        const b = el("button", "tab");
        b.type = "button";
        b.dataset.id = tab.id;
        b.innerHTML = `${tab.label}<small>${tab.items.filter((e) => opened(e.stages[0])).length}/${tab.items.length}</small>`;
        b.addEventListener("click", () => drawCat(tab));
        sbar.append(b);
      });
      const drawCat = (tab) => {
        sbar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.id === tab.id));
        listEntries(tab.items, body.querySelector(".codex-cat"));
      };
      drawCat(stabs[0]);
    };
    const listEntries = (es, target) => {
      target.innerHTML = `<ul class="ach-list codex-list">${es
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
      const cats = Object.keys(i.t("achievementsScreen.categories")).filter((c) => achList.some((a) => a.category === c && unlocked.includes(a.id)));
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
  karma(total, shop, onBuy, onBack, tr, mem) {
    const t = (k, v) => this.i.t(k, v);
    const sec = el("section", "sub-screen");
    sec.innerHTML = `
      <h2>${t("karmaScreen.title")}</h2>
      <p class="big">${total}</p>
      <p class="sub">${t("karmaScreen.sub")}</p>
      <div class="tabs main-tabs shop-tabs" role="tablist"></div>
      <ul class="shop base"></ul>
      <ul class="shop traits"></ul>
      <ul class="shop memories"></ul>
      <ul class="shop arts"></ul>`;
    // 탭: 타고난 바탕 / 체질 (산 뒤에 다시 그려도 보던 탭을 유지)
    const allMems = shop.visibleMemories();
    const mems = allMems.filter((m) => m.tab !== "arts");
    const arts = allMems.filter((m) => m.tab === "arts"); // 업에 새긴 무공: 기억과 같은 방식, 탭만 따로
    const unseen = shop.unseenMemories();
    const tabs = [["base", t("karmaScreen.shopTitle")], ["traits", t("karmaScreen.traitTitle")]];
    if (mems.length) tabs.push(["memories", t("karmaScreen.memoryTitle")]); // 장의 끝을 본 뒤에만 보인다
    if (arts.length) tabs.push(["arts", t("karmaScreen.artTitle")]);
    const bar = sec.querySelector(".shop-tabs");
    const pick = (id) => {
      this.shopTab = id;
      bar.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.id === id)));
      sec.querySelector(".shop.base").hidden = id !== "base";
      sec.querySelector(".shop.traits").hidden = id !== "traits";
      sec.querySelector(".shop.memories").hidden = id !== "memories";
      sec.querySelector(".shop.arts").hidden = id !== "arts";
      if ((id === "memories" || id === "arts") && unseen.length) mem.seen();
    };
    for (const [id, label] of tabs) {
      const b = el("button", "tab");
      b.type = "button";
      b.dataset.id = id;
      b.id = `shop-tab-${id}`;
      b.innerHTML = label + (id === "memories" && unseen.length ? ` <span class="new-mark">${t("game.fresh")}</span>` : "");
      b.addEventListener("click", () => pick(id));
      bar.append(b);
    }
    const ul = sec.querySelector(".shop.base");
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
      // 단계가 여럿인 체질은 단계 점(●○)과 지금 단계·다음 경지를 보여 준다
      const multi = it.tiers.length > 1;
      const pips = multi ? `<span class="tier-pips">${it.tiers.map((_, k) => (k < lv ? "●" : "○")).join("")}</span>` : "";
      const up = multi && lv
        ? `<span class="tier-line">${next ? t("karmaScreen.tierNext", { lv, name: t(`karmaScreen.traits.${next.name}.name`), desc: t(`karmaScreen.traits.${next.name}.desc`) }) : t("karmaScreen.tierMax", { lv })}</span>`
        : "";
      li.innerHTML = `<div class="shop-info"><b>${t(`karmaScreen.traits.${tier.name}.name`)}${pips}</b><span class="lore">${t(`karmaScreen.traits.${tier.name}.lore`)}</span><span>${t(`karmaScreen.traits.${tier.name}.desc`)}</span>${up}${state}</div>`;
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
    const drawMem = (ml, list, pre) => list.forEach((m, n) => {
      const owned = shop.memoryOwned(m.id);
      const on = shop.memoryOn(m.id);
      const li = el("li", "shop-row");
      const state = owned ? `<span class="shop-lv">${t(on ? "karmaScreen.traitOn" : "karmaScreen.traitOff")}</span>` : "";
      const fresh = unseen.includes(m.id) ? ` <span class="new-mark">${t("game.fresh")}</span>` : "";
      li.innerHTML = `<div class="shop-info"><b>${t(`karmaScreen.memories.${m.id}.name`)}${fresh}</b><span class="lore">${t(`karmaScreen.memories.${m.id}.lore`)}</span><span>${t(`karmaScreen.memories.${m.id}.desc`)}</span>${state}</div>`;
      const box = el("div", "shop-btns");
      const b = el("button", "shop-buy");
      b.type = "button";
      b.id = `${pre}-${n}`;
      if (owned) {
        b.textContent = t(on ? "karmaScreen.turnOff" : "karmaScreen.turnOn");
        b.addEventListener("click", () => mem.toggle(m.id));
      } else {
        b.textContent = t("karmaScreen.buy", { p: m.price });
        b.disabled = total < m.price;
        b.addEventListener("click", () => mem.buy(m.id));
      }
      box.append(b);
      li.append(box);
      ml.append(li);
    });
    drawMem(sec.querySelector(".shop.memories"), mems, "memory");
    drawMem(sec.querySelector(".shop.arts"), arts, "art");
    const ok = (tab) => (tab === "memories" ? mems.length : tab === "arts" ? arts.length : true);
    pick(this.shopTab && ok(this.shopTab) ? this.shopTab : "base");
    this.show(sec, onBack);
  }

  // current: 설정값, languages: [{id, name}], h: { fontSize, language, wipe }
  settings(current, languages, h, onBack) {
    const t = (k) => this.i.t(k);
    const sec = el("section", "sub-screen");
    sec.innerHTML = `<h2>${t("settings.title")}</h2>
      <div class="set-row"><span class="set-lbl">${t("settings.fontSize")}</span><div class="seg" id="seg-fs" role="group"></div></div>
      <div class="set-row"><span class="set-lbl">${t("settings.termMode")}</span><p class="set-note">${t("settings.termNote")}</p><div class="seg" id="seg-term" role="group"></div></div>
      <div class="set-row"><span class="set-lbl">${t("settings.sound")}</span><div class="seg" id="seg-sound" role="group"></div></div>
      ${languages.length > 1 ? `<div class="set-row"><span class="set-lbl">${t("settings.language")}</span><div class="seg" id="seg-lang" role="group"></div></div>` : ""}
      <div class="set-row danger"><span class="set-lbl">${t("settings.wipe")}</span><p class="set-note">${t("settings.wipeNote")}</p></div>`;
    segment(sec.querySelector("#seg-fs"), FONT_SIZES.map((f) => ({ id: f.id, label: t(`settings.sizes.${f.id}`) })), current.fontSize, "fs", h.fontSize);
    segment(sec.querySelector("#seg-term"), TERM_MODES.map((m) => ({ id: m, label: t(`settings.termModes.${m}`) })), current.termMode ?? "twice", "term", h.termMode);
    segment(sec.querySelector("#seg-sound"), SOUND_LEVELS.map((x) => ({ id: x.id, label: t(`settings.sounds.${x.id}`) })), current.sound ?? "mid", "sound", h.sound);
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
    // 시험용 업 버튼 (config.testKarma가 0이면 숨김)
    if (h.testKarma) {
      const row = el("div", "set-row");
      row.innerHTML = `<span class="set-lbl">${t("settings.test")}</span>`;
      const tb = el("button", "wipe");
      tb.type = "button";
      tb.id = "test-karma";
      tb.textContent = t("settings.testKarma");
      tb.addEventListener("click", () => { h.testKarma(); tb.textContent = t("settings.testDone"); });
      row.append(tb);
      if (h.testBattle) {
        const fb = el("button", "wipe");
        fb.type = "button";
        fb.id = "test-battle";
        fb.textContent = t("settings.testBattle");
        fb.addEventListener("click", () => h.testBattle());
        row.append(fb);
      }
      sec.append(row);
    }
    this.show(sec, onBack);
  }

  // 시험용 전투 설정: 능력치 입력과 무공 선택. onFight(stats, artIds)
  battleTest(base, arts, items, onFight, onBack) {
    const t = (k, v) => this.i.t(k, v);
    const sec = el("section", "sub-screen");
    const keys = ["경지", "최대체력", "근골", "민첩", "행운", "내공"];
    sec.innerHTML = `<h2>${t("settings.testBattle")}</h2><p class="sub">${t("settings.testBattleNote")}</p>
      <div class="bt-grid">${keys.map((k) => `<label>${this.i.stat(k)}<input type="number" min="0" id="bt-${k}" value="${base.stat(k)}"></label>`).join("")}</div>
      <div class="bt-arts">${arts.map((a) => `<label><input type="checkbox" value="${a.id}"> ${this.i.combat(`art.${a.id}.name`)}</label>`).join("")}</div>
      <div class="bt-arts bt-items">${items.map((x) => `<label><input type="checkbox" value="${x.id}" ${base.hasItem(x.id) ? "checked" : ""}> ${this.i.item(x.id)}</label>`).join("")}</div>`;
    const go = el("button", "next");
    go.type = "button";
    go.textContent = t("settings.testFight");
    go.addEventListener("click", () => {
      const stats = Object.fromEntries(keys.map((k) => [k, Number(sec.querySelector(`#bt-${k}`).value) || 0]));
      const ids = [...sec.querySelectorAll(".bt-arts:not(.bt-items) input:checked")].map((x) => x.value);
      const itemIds = [...sec.querySelectorAll(".bt-items input:checked")].map((x) => x.value);
      onFight(stats, ids, itemIds);
    });
    sec.append(go);
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
