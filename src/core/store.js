// 브라우저 저장소 감싸기. 저장이 막힌 환경에서도 게임이 멈추지 않게 한다.
export const Store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  },
};
