// 키보드 입력을 지금 보이는 화면 하나에만 전달한다.
let handler = null;

document.addEventListener("keydown", (e) => {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
  if (handler?.(e)) e.preventDefault();
});

// 키 꾹 누르기: 누르고 있는 동안 gauge 게이지가 차고, 다 차면 onFire. 떼면 취소.
class KeyHold {
  constructor(ms = 650) {
    this.ms = ms;
    this.key = null;
    this.timer = null;
    this.gauge = null;
    document.addEventListener("keyup", (e) => { if (e.key === this.key) this.cancel(); });
    window.addEventListener("blur", () => this.cancel());
  }

  start(key, gauge, onFire) {
    this.cancel();
    this.key = key;
    this.gauge = gauge;
    gauge.style.setProperty("--hold", `${this.ms}ms`);
    gauge.classList.add("holding");
    this.timer = setTimeout(() => { this.cancel(); onFire(); }, this.ms);
  }

  cancel() {
    clearTimeout(this.timer);
    this.timer = null;
    this.gauge?.classList.remove("holding");
    this.gauge = null;
    this.key = null;
  }
}

const hold = new KeyHold();

export const Keys = {
  set(fn) {
    hold.cancel();
    handler = fn;
  },
  clear() {
    hold.cancel();
    handler = null;
  },
  // 지금 눌린 key를 꾹 누르고 있으면 onFire
  hold(key, gauge, onFire) {
    hold.start(key, gauge, onFire);
  },
};
