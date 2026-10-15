// 전투 화면: 적과 나의 체력 막대, 합마다의 전투 기록, 공격·무공·방어 선택.
import { button, el } from "./view.js";
import { lineToHtml } from "./markup.js";

export class BattleScreen {
  constructor(view, i18n) {
    this.view = view;
    this.i = i18n;
  }
  bar(hp, max) {
    const n = Math.max(0, Math.min(10, Math.ceil((hp / Math.max(1, max)) * 10)));
    return `<span class="hpbar${n <= 3 ? " low" : ""}"><i style="width:${n * 10}%"></i></span>`;
  }
  // 피해 크기를 말로: 상대 최대 체력 대비
  tier(dmg, max) {
    const r = dmg / Math.max(1, max);
    return r < 0.15 ? "light" : r < 0.35 ? "mid" : "heavy";
  }
  line(b, r) {
    const t = (k, v) => this.i.t(k, v);
    const enemy = this.i.combat(`enemy.${b.enemy.id}.name`);
    const art = r.art ? this.i.combat(`art.${r.art}.name`) : null;
    if (r.who === "me") {
      if (!r.hit) return t("battle.meMiss", { art: art ? `${art}. ` : "" });
      const head = (art ? `**${art}!** ` : "") + (r.crit ? t("battle.crit") + " " : "");
      return head + t(`battle.meHit.${this.tier(r.dmg, b.enemy.max)}`, { enemy });
    }
    if (r.blind) return t("battle.blindMiss");
    if (!r.hit) return t("battle.enemyMiss", { enemy });
    if (r.dmg === 0) return t("battle.guarded", { enemy });
    const max = b.player.stat("최대체력");
    return (r.crit ? t("battle.enemyCrit", { enemy }) + " " : "") + t(`battle.enemyHit.${this.tier(r.dmg, max)}`, { enemy });
  }
  // 포켓몬 배틀처럼: 위쪽에 적·나의 이름표와 체력 막대, 그 아래 전투 글, 맨 아래 명령 칸(항상 고정).
  // 전투 글은 한 줄씩 저절로 흐르고(Enter·클릭으로 빨리 넘김), 그동안 명령 칸은 흐려져 잠긴다.
  // battle: Battle, onEnd(result: "win" | "lose")
  run(b, onEnd) {
    const i = this.i;
    const enemy = i.combat(`enemy.${b.enemy.id}.name`);
    const delay = this.view.config.combat.lineDelay ?? 1000;
    const snap = (t, e = b.enemy.hp, m = b.player.stat("체력")) => ({ t, e, m });
    let shown = snap("");
    let lines = []; // 화면에 쌓인 이번 공방의 글
    let queue = [snap(i.t("battle.appear", { enemy })), snap(i.t(b.playerFirst ? "battle.meFirst" : "battle.enemyFirst", { enemy }))];
    let mode = "cmd"; // cmd | arts | items
    let busy = false;
    let cursor = 0;
    let page = 0;
    let timer = null;
    const sec = el("section", "battle pk");
    sec.innerHTML = `
      <div class="pk-field">
        <div class="pk-tag pk-enemy"><b>${enemy}</b><span class="pk-bar"></span></div>
        <div class="pk-tag pk-me"><b>${i.t("battle.me")} · <small></small></b><span class="pk-bar"></span></div>
      </div>
      <div class="pk-log prose"></div>
      <div class="pk-box">
        <p class="pk-prompt"></p>
        <div class="pk-menu"></div>
        <div class="pk-foot"></div>
      </div>`;
    const $ = (q) => sec.querySelector(q);
    const drawField = () => {
      $(".pk-enemy .pk-bar").innerHTML = this.bar(shown.e, b.enemy.max);
      $(".pk-me .pk-bar").innerHTML = this.bar(shown.m, b.player.stat("최대체력"));
      $(".pk-me small").textContent = i.realm(b.player.stat("경지"));
      $(".pk-log").innerHTML = lines.map((l) => `<p>${lineToHtml(l)}</p>`).join("");
    };
    const list = () => (mode === "arts" ? b.usableArts() : b.usableItems());
    const cells = () => {
      if (mode === "cmd") {
        return [
          { label: i.t("battle.attack"), run: () => act({ type: "attack" }) },
          { label: i.t("battle.arts"), ok: b.usableArts().length > 0, run: () => { mode = "arts"; cursor = 0; page = 0; drawMenu(); } },
          { label: i.t("battle.guard"), run: () => act({ type: "guard" }) },
          { label: i.t("battle.items"), ok: b.usableItems().length > 0, run: () => { mode = "items"; cursor = 0; page = 0; drawMenu(); } },
        ];
      }
      const out = list().slice(page * 4, page * 4 + 4).map((x) =>
        mode === "arts"
          ? { label: i.combat(`art.${x.id}.name`), tag: i.t("battle.cost", { n: x.cost }), ok: x.ok, run: () => act({ type: "art", art: x }) }
          : { label: i.item(x.id), tag: i.t(`battle.itemDesc.${x.id}`), run: () => act({ type: "item", item: x }) }
      );
      while (out.length < 4) out.push({ label: "", ok: false });
      return out;
    };
    const drawMenu = () => {
      sec.classList.toggle("busy", busy);
      $(".pk-prompt").textContent = i.t(mode === "cmd" ? "battle.prompt" : mode === "arts" ? "battle.pickArt" : "battle.pickItem");
      const menu = $(".pk-menu");
      const foot = $(".pk-foot");
      menu.innerHTML = "";
      foot.innerHTML = "";
      cells().forEach((c, n) => {
        const btn = el("button", "pk-cell" + (n === cursor ? " on" : ""));
        btn.type = "button";
        btn.disabled = busy || c.ok === false;
        btn.innerHTML = c.label ? `<span>${c.label}</span>${c.tag ? `<small>${c.tag}</small>` : ""}` : "";
        btn.addEventListener("click", () => { if (!busy && c.ok !== false) c.run(); });
        menu.append(btn);
      });
      if (mode !== "cmd") {
        const pages = Math.ceil(list().length / 4);
        if (pages > 1) {
          const prev = el("button", "pk-small"); prev.textContent = "◀"; prev.disabled = page === 0;
          prev.addEventListener("click", () => { page -= 1; cursor = 0; drawMenu(); });
          const next = el("button", "pk-small"); next.textContent = "▶"; next.disabled = page >= pages - 1;
          next.addEventListener("click", () => { page += 1; cursor = 0; drawMenu(); });
          foot.append(prev, next);
        }
        const back = el("button", "pk-small"); back.textContent = i.t("battle.back");
        back.addEventListener("click", () => toCmd());
        foot.append(back);
      }
    };
    const toCmd = () => { mode = "cmd"; cursor = 0; drawMenu(); };
    // 글 한 줄 흘려보내기: 다 흐르면 명령 칸을 다시 연다 (전투가 끝났으면 결과로)
    const step = () => {
      clearTimeout(timer);
      if (!queue.length) {
        busy = false;
        this.view.stats(b.player);
        if (b.over) return setTimeout(() => onEnd(b.over), delay);
        return toCmd();
      }
      shown = queue.shift();
      lines.push(shown.t);
      drawField();
      timer = setTimeout(step, delay);
    };
    sec.addEventListener("click", (e) => { if (busy && !e.target.closest(".pk-box")) step(); });
    const act = (a) => {
      let e = b.enemy.hp;
      let m = b.player.stat("체력");
      const res = b.turn(a);
      lines = [];
      queue = a.type === "guard" ? [snap(i.t("battle.guardStance"), e, m)] : [];
      for (const r of res) {
        if (r.who === "me") e -= r.dmg;
        else if (r.who === "enemy") m -= r.dmg;
        else m = b.player.stat("체력"); // 소지품 (회복 등)
        queue.push(snap(r.who === "item" ? i.t(`battle.itemUse.${r.item}`) : this.line(b, r), e, m));
      }
      if (b.over) queue.push(snap(i.t(`battle.${b.over}`, { enemy }), e, m));
      busy = true;
      mode = "cmd"; // 행동한 뒤에는 명령 칸으로 (글이 다 흐를 때까지 흐리게)
      cursor = 0;
      drawMenu();
      step();
    };
    this.view.show(sec);
    busy = true;
    drawField();
    drawMenu();
    step();
    this.view.keys((e) => {
      if (busy) {
        if (e.key === "Enter" || e.key === " ") { step(); return true; }
        return false;
      }
      const cs = cells();
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key];
      if (move) { cursor = (cursor + move + 4) % 4; drawMenu(); return true; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { cursor = n - 1; if (cs[cursor].ok !== false) cs[cursor].run(); else drawMenu(); return true; }
      if (e.key === "Enter") { if (cs[cursor].ok !== false) cs[cursor].run(); return true; }
      if (e.key === "Escape" && mode !== "cmd") { toCmd(); return true; }
      return false;
    });
  }
}
