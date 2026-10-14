// 메인 화면과 그 하위 화면(인과록, 업, 설정). 게임 규칙은 모른다.
// 조작: 메인에서는 숫자키로 바로 이동, 하위 화면은 Esc로 돌아가기.
import { Keys } from "./keys.js";
import { el } from "./view.js";
import { FONT_SIZES } from "../meta/settings.js";

export class MenuScreens {
  constructor(root) {
    this.layer = root.querySelector("#screen");
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
      back.innerHTML = `돌아가기<kbd>Esc</kbd>`;
      back.addEventListener("click", onBack);
      sec.prepend(back);
      Keys.set((e) => (e.key === "Escape" ? (onBack(), true) : false));
    }
  }

  // info: { lives, karma, hasSave }, h: { continue, newLife, achievements, karma, settings }
  main(info, h) {
    const sec = el("section", "menu");
    sec.innerHTML = `
      <div class="mast">
        <p class="eyebrow">하계 · 무림 · 표류</p>
        <h1>선협</h1>
        <p class="sub">${info.lives ? `지금까지 <b>${info.lives}</b>번의 생을 살았다 · 업 <b>${info.karma}</b>` : "아직 한 번도 살지 않았다."}</p>
      </div>`;
    const items = [
      { label: "이어서 하기", run: h.continue, off: !info.hasSave, note: info.hasSave ? "" : "이어갈 생이 없다" },
      { label: "새로 하기", run: h.newLife, note: info.hasSave ? "진행 중인 생은 사라진다" : "" },
      { label: "인과록", run: h.achievements },
      { label: "업", run: h.karma },
      { label: "설정", run: h.settings },
    ];
    const nav = el("nav", "menu-list");
    let armed = false; // 새로 하기 두 번 확인용
    items.forEach((it, i) => {
      const b = el("button", "menu-item");
      b.type = "button";
      b.disabled = !!it.off;
      b.innerHTML = `<span class="num">${i + 1}</span><span class="lbl">${it.label}</span>${it.note ? `<span class="mnote">${it.note}</span>` : ""}`;
      b.addEventListener("click", () => {
        if (it.label === "새로 하기" && info.hasSave && !armed) {
          armed = true;
          b.classList.add("armed");
          b.querySelector(".mnote").textContent = "한 번 더 누르면 진행 중인 생을 버리고 시작한다";
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

  achievements(list, unlocked, outcomeCount, onBack) {
    const sec = el("section", "sub-screen");
    const got = list.filter((a) => unlocked.includes(a.id)).length;
    sec.innerHTML = `
      <h2>인과록</h2>
      <p class="sub">새긴 인과 <b>${got}</b> / ${list.length} · 겪어본 갈림길 <b>${outcomeCount}</b></p>
      <ul class="ach-list">${list
        .map((a) =>
          unlocked.includes(a.id)
            ? `<li class="on"><b>${a.name}</b><span>${a.desc}</span></li>`
            : `<li><b>???</b><span>${a.hint}</span></li>`
        )
        .join("")}</ul>`;
    this.show(sec, onBack);
  }

  karma(total, onBack) {
    const sec = el("section", "sub-screen");
    sec.innerHTML = `
      <h2>업</h2>
      <p class="big">${total}</p>
      <p class="sub">전생에서 쌓은 업이다.</p>
      <p class="empty">업을 쓸 곳은 아직 정해지지 않았다.</p>`;
    this.show(sec, onBack);
  }

  settings(current, h, onBack) {
    const sec = el("section", "sub-screen");
    sec.innerHTML = `<h2>설정</h2>
      <div class="set-row"><span class="set-lbl">글자 크기</span><div class="seg" role="group" aria-label="글자 크기"></div></div>
      <div class="set-row danger"><span class="set-lbl">기록 전부 지우기</span><p class="set-note">생의 횟수, 업, 인과록, 진행 중인 생이 모두 사라진다.</p></div>`;
    const seg = sec.querySelector(".seg");
    FONT_SIZES.forEach((f) => {
      const b = el("button", "seg-btn" + (f.id === current.fontSize ? " on" : ""));
      b.type = "button";
      b.id = `fs-${f.id}`;
      b.textContent = f.label;
      b.addEventListener("click", () => {
        h.fontSize(f.id);
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      });
      seg.append(b);
    });
    const wipe = el("button", "wipe");
    wipe.type = "button";
    wipe.id = "wipe";
    wipe.textContent = "지우기";
    let armed = false;
    wipe.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        wipe.textContent = "정말 지운다";
        wipe.classList.add("armed");
        return;
      }
      h.wipe();
      wipe.textContent = "지웠다";
      wipe.disabled = true;
    });
    sec.querySelector(".danger").append(wipe);
    this.show(sec, onBack);
  }
}
