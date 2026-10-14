// 용어 풀이 창. 표시된 단어(.term)에 마우스를 올리면 뜨고, 떼면 사라진다.
// 휴대폰처럼 마우스가 없으면 누를 때마다 열고 닫는다. 키보드로 포커스해도 뜬다.
export class Tooltip {
  constructor(root, i18n) {
    this.i = i18n;
    this.box = document.createElement("div");
    this.box.className = "gloss";
    this.box.setAttribute("role", "tooltip");
    this.box.hidden = true;
    root.body.append(this.box);
    this.current = null;

    const termOf = (e) => e.target.closest?.(".term");
    root.addEventListener("mouseover", (e) => { const t = termOf(e); if (t) this.open(t); });
    root.addEventListener("mouseout", (e) => { const t = termOf(e); if (t && !t.contains(e.relatedTarget)) this.close(); });
    root.addEventListener("focusin", (e) => { const t = termOf(e); if (t) this.open(t); });
    root.addEventListener("focusout", (e) => { if (termOf(e)) this.close(); });
    root.addEventListener("click", (e) => {
      const t = termOf(e);
      if (t && window.matchMedia("(hover: none)").matches) {
        this.current === t && !this.box.hidden ? this.close() : this.open(t);
      } else if (!t) this.close();
    });
    window.addEventListener("scroll", () => this.close(), { passive: true });
  }

  open(el) {
    const text = this.i.gloss(el.dataset.term);
    if (!text) return;
    this.current = el;
    this.box.innerHTML = `<b>${el.dataset.term}</b><span>${text}</span>`;
    this.box.hidden = false;
    const r = el.getBoundingClientRect();
    const w = this.box.offsetWidth, h = this.box.offsetHeight;
    const margin = 12;
    const left = Math.min(Math.max(margin, r.left + r.width / 2 - w / 2), window.innerWidth - w - margin);
    const above = r.top - h - 8;
    const top = above > margin ? above : r.bottom + 8;
    this.box.style.left = `${left}px`;
    this.box.style.top = `${top}px`;
  }

  close() {
    this.box.hidden = true;
    this.current = null;
  }
}
