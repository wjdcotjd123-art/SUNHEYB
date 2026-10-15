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
  // battle: Battle, onEnd(result: "win" | "lose")
  run(b, onEnd) {
    const i = this.i;
    const enemy = i.combat(`enemy.${b.enemy.id}.name`);
    let log = [i.t(b.playerFirst ? "battle.meFirst" : "battle.enemyFirst", { enemy })];
    const render = () => {
      const sec = el("section", "battle");
      sec.innerHTML = `<p class="battle-head">${i.t("battle.title")}</p>
        <div class="fighters">
          <div><b>${enemy}</b>${this.bar(b.enemy.hp, b.enemy.max)}</div>
          <div><b>${i.t("battle.me")}</b>${this.bar(b.player.stat("체력"), b.player.stat("최대체력"))}</div>
        </div>
        <div class="prose battle-log">${log.map((l) => `<p>${lineToHtml(l)}</p>`).join("")}</div>`;
      const list = el("div", "choices");
      if (b.over) {
        sec.innerHTML += `<p class="battle-end ${b.over}">${i.t(`battle.${b.over}`, { enemy })}</p>`;
        const go = button(i.t("game.continue"), () => onEnd(b.over));
        sec.append(go);
        this.view.show(sec);
        this.view.keys((e) => (e.key === "Enter" ? (go.click(), true) : false));
        return;
      }
      const acts = [{ type: "attack", label: i.t("battle.attack"), tag: i.stat("근골") }];
      for (const a of b.usableArts()) acts.push({ type: "art", art: a, ok: a.ok, label: i.combat(`art.${a.id}.name`), tag: i.t("battle.cost", { n: a.cost }) });
      acts.push({ type: "guard", label: i.t("battle.guard") });
      acts.forEach((a, n) => {
        const btn = el("button", "choice");
        btn.type = "button";
        btn.disabled = a.ok === false;
        btn.innerHTML = `<span class="num">${n + 1}</span><span class="txt">${a.label}${a.tag ? ` <span class="req">[${a.tag}]</span>` : ""}</span>`;
        btn.addEventListener("click", () => act(a));
        list.append(btn);
      });
      sec.append(list);
      this.view.show(sec);
      this.view.keys((e) => {
        const k = Number(e.key);
        if (k >= 1 && k <= acts.length && acts[k - 1].ok !== false) { act(acts[k - 1]); return true; }
        return false;
      });
    };
    const act = (a) => {
      const res = b.turn(a);
      log = [i.t("battle.round", { n: b.round }), ...(a.type === "guard" ? [i.t("battle.guardStance")] : []), ...res.map((r) => this.line(b, r))];
      this.view.stats(b.player);
      render();
    };
    render();
  }
}
