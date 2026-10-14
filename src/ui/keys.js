// 키보드 입력을 지금 보이는 화면 하나에만 전달한다.
let handler = null;

document.addEventListener("keydown", (e) => {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
  if (handler?.(e)) e.preventDefault();
});

export const Keys = {
  set(fn) {
    handler = fn;
  },
  clear() {
    handler = null;
  },
};
