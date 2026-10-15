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
    if (!r.hit) return t("battle.enemyMiss", { enemy });
    if (r.dmg === 0) return t("battle.guarded", { enemy });
    const max = b.player.stat("최대체력");
    return (r.crit ? t("battle.enemyCrit", { enemy }) + " " : "") + t(`battle.enemyHit.${this.tier(r.dmg, max)}`, { enemy });
  }
  // 포켓몬 배틀처럼: 위쪽에 적·나의 이름표와 체력 막대, 아래에 글 상자와 2×2 명령 칸.
  // 글은 한 줄씩 넘기고(Enter·클릭), 명령은 방향키·숫자키·Enter로 고른다. 무공 칸에서는 Esc로 돌아간다.
  // battle: Battle, onEnd(result: "win" | "lose")
  run(b, onEnd) {
    const i = this.i;
    const enemy = i.combat(`enemy.${b.enemy.id}.name`);
    const realmName = () => i.realm(b.player.stat("경지"));
    let mode = "msg"; // msg | cmd | arts
    // 글 줄마다 그 순간의 체력을 같이 들고 다닌다 (글을 넘길 때 막대가 줄어들게)
    const snap = (t, e = b.enemy.hp, m = b.player.stat("체력")) => ({ t, e, m });
    let queue = [snap(i.t("battle.appear", { enemy })), snap(i.t(b.playerFirst ? "battle.meFirst" : "battle.enemyFirst", { enemy }))];
    let shown = queue[0];
    let cursor = 0;
    let page = 0;
    const sec = el("section", "battle pk");
    sec.innerHTML = `
      <div class="pk-field">
        <div class="pk-tag pk-enemy"><b>${enemy}</b><span class="pk-bar"></span></div>
        <div class="pk-tag pk-me"><b>${i.t("battle.me")} · <small></small></b><span class="pk-bar"></span></div>
      </div>
      <div class="pk-box">
        <div class="pk-text prose"></div>
        <div class="pk-menu"></div>
        <div class="pk-foot"></div>
      </div>`;
    const $ = (q) => sec.querySelector(q);
    const bars = () => {
      $(".pk-enemy .pk-bar").innerHTML = this.bar(shown.e, b.enemy.max);
      $(".pk-me .pk-bar").innerHTML = this.bar(shown.m, b.player.stat("최대체력"));
      $(".pk-me small").textContent = realmName();
    };
    // 지금 칸들 [{label, tag, ok, run}]
    const cells = () => {
      if (mode === "cmd") {
        const arts = b.usableArts();
        return [
          { label: i.t("battle.attack"), run: () => act({ type: "attack" }) },
          { label: i.t("battle.arts"), ok: arts.length > 0, run: () => { mode = "arts"; cursor = 0; page = 0; draw(); } },
          { label: i.t("battle.guard"), run: () => act({ type: "guard" }) },
          { label: "", ok: false },
        ];
      }
      const arts = b.usableArts().slice(page * 4, page * 4 + 4);
      const out = arts.map((a) => ({ label: i.combat(`art.${a.id}.name`), tag: i.t("battle.cost", { n: a.cost }), ok: a.ok, run: () => act({ type: "art", art: a }) }));
      while (out.length < 4) out.push({ label: "", ok: false });
      return out;
    };
    const draw = () => {
      if (mode === "msg") shown = queue[0];
      bars();
      const text = $(".pk-text");
      const menu = $(".pk-menu");
      const foot = $(".pk-foot");
      menu.innerHTML = "";
      foot.innerHTML = "";
      if (mode === "msg") {
        text.innerHTML = `<p>${lineToHtml(queue[0].t)}</p><span class="pk-more">▼</span>`;
        sec.classList.add("reading");
        return;
      }
      sec.classList.remove("reading");
      text.innerHTML = `<p>${i.t(mode === "cmd" ? "battle.prompt" : "battle.pickArt")}</p>`;
      cells().forEach((c, n) => {
        const btn = el("button", "pk-cell" + (n === cursor ? " on" : ""));
        btn.type = "button";
        btn.disabled = c.ok === false;
        btn.innerHTML = c.label ? `<span>${c.label}</span>${c.tag ? `<small>${c.tag}</small>` : ""}` : "";
        btn.addEventListener("click", () => { if (c.ok !== false) c.run(); });
        menu.append(btn);
      });
      if (mode === "arts") {
        const pages = Math.ceil(b.usableArts().length / 4);
        if (pages > 1) {
          const prev = el("button", "pk-small"); prev.textContent = "◀"; prev.disabled = page === 0;
          prev.addEventListener("click", () => { page -= 1; cursor = 0; draw(); });
          const next = el("button", "pk-small"); next.textContent = "▶"; next.disabled = page >= pages - 1;
          next.addEventListener("click", () => { page += 1; cursor = 0; draw(); });
          foot.append(prev, next);
        }
        const back = el("button", "pk-small"); back.textContent = i.t("battle.back");
        back.addEventListener("click", () => { mode = "cmd"; cursor = 1; draw(); });
        foot.append(back);
      }
    };
    // 글 한 줄 넘기기
    const advance = () => {
      queue.shift();
      if (queue.length) return draw();
      this.view.stats(b.player); // 글을 다 넘긴 뒤 위쪽 능력치 창도 맞춘다
      if (b.over) return onEnd(b.over);
      mode = "cmd";
      cursor = 0;
      draw();
    };
    sec.querySelector(".pk-text").addEventListener("click", () => { if (mode === "msg") advance(); });
    const act = (a) => {
      let e = b.enemy.hp;
      let m = b.player.stat("체력");
      const res = b.turn(a);
      queue = a.type === "guard" ? [snap(i.t("battle.guardStance"), e, m)] : [];
      for (const r of res) {
        if (r.who === "me") e -= r.dmg; else m -= r.dmg;
        queue.push(snap(this.line(b, r), e, m));
      }
      if (b.over) queue.push(snap(i.t(`battle.${b.over}`, { enemy }), e, m));
      mode = "msg";
      draw();
    };
    this.view.show(sec);
    draw();
    this.view.keys((e) => {
      if (mode === "msg") {
        if (e.key === "Enter" || e.key === " ") { advance(); return true; }
        return false;
      }
      const cs = cells();
      const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key];
      if (move) { cursor = (cursor + move + 4) % 4; draw(); return true; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { cursor = n - 1; if (cs[cursor].ok !== false) cs[cursor].run(); else draw(); return true; }
      if (e.key === "Enter") { if (cs[cursor].ok !== false) cs[cursor].run(); return true; }
      if (e.key === "Escape" && mode === "arts") { mode = "cmd"; cursor = 1; draw(); return true; }
      return false;
    });
  }
}
