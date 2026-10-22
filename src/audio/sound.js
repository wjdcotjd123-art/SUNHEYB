// 효과음: 소리 파일 없이 브라우저에서 합성한다(Web Audio).
// 쪽 넘김(묵은 한지), 경지 상승(풍경), 기연·드문 인과(편경 도·레·솔), 죽음(멎는 심장), 귀결(징).
export const SOUND_LEVELS = [
  { id: "off", gain: 0 },
  { id: "low", gain: 0.4 },
  { id: "mid", gain: 0.7 },
  { id: "high", gain: 1 },
];

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
  }

  setLevel(id) {
    this.volume = (SOUND_LEVELS.find((x) => x.id === id) ?? SOUND_LEVELS[2]).gain;
    if (this.master) this.master.gain.value = this.volume;
  }

  // 자리 이름: realm / fortune / death / ending
  play(cue) {
    if (!this.volume || !this[cue]) return;
    try {
      this.init();
      if (this.ctx.state === "suspended") this.ctx.resume();
      this[cue](this.ctx.currentTime + 0.03);
    } catch {
      // 소리를 낼 수 없는 환경이면 조용히 넘어간다
    }
  }

  init() {
    if (this.ctx) return;
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    // 절간 같은 울림: 지수로 줄어드는 잡음으로 만든 잔향
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(2.5, 2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    this.verb.connect(wet).connect(this.master);
    // 묵직한 타격음용: 살짝 뭉개고 높은 쪽을 깎는다
    this.sat = ctx.createWaveShaper();
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) c[i] = Math.tanh(2.2 * (i / 511.5 - 1)) / Math.tanh(2.2);
    this.sat.curve = c;
    this.satLp = ctx.createBiquadFilter();
    this.satLp.type = "lowpass";
    this.satLp.frequency.value = 900;
    this.sat.connect(this.satLp);
  }

  impulse(sec, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // 마른 소리(dry)와 잔향(wet)을 섞어 내보내는 입구
  out(dry, wet) {
    const g = this.ctx.createGain(), d = this.ctx.createGain(), w = this.ctx.createGain();
    d.gain.value = dry;
    w.gain.value = wet;
    g.connect(d).connect(this.master);
    g.connect(w).connect(this.verb);
    return g;
  }

  lowpass(freq, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    f.connect(dest);
    return f;
  }

  // 부분음 하나: 주파수, 크기, 울림 길이, 시작 시각, 내보낼 곳, 붙는 시간, 끝 주파수 배율
  partial(freq, amp, dur, t, dest, attack = 0.004, glide = 0) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, t, dest, freq, amp, q = 0.7) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf;
    f.type = "lowpass";
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t);
  }

  // 쪽 넘김: 두꺼운 한지가 낮게 두 번 결을 스치는 '사-락'(0.2초)
  page(t) {
    const out = this.out(1, 0.03);
    this.rasp(t, 0.08, 700, 450, 0.35, 1200, out);
    this.rasp(t + 0.07, 0.13, 520, 280, 0.45, 1000, out);
  }

  // 종이 결 스침 한 번: 섬유 알갱이 섞인 잡음을 대역으로 걸러 주파수를 내린다
  rasp(t, dur, f0, f1, amp, lpf, dest) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * (dur + 0.02)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.7 + (Math.random() < 0.035 ? (Math.random() * 2 - 1) * 0.6 : 0);
    const s = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf;
    bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    lp.type = "lowpass"; lp.frequency.value = lpf;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(lp).connect(g).connect(dest);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  // 경지 상승: 맑은 풍경 한 음
  realm(t) {
    const out = this.out(0.85, 0.35), lp = this.lowpass(2200, out);
    [[1, 0.13, 1.8], [2.0, 0.025, 0.9], [2.76, 0.012, 0.5]].forEach(([r, a, d]) => this.partial(659.3 * r, a, d, t, lp, 0.012));
    this.partial(130.8, 0.05, 1.8, t, out, 0.25);
  }

  // 기연·드문 인과: 낮은 도 위의 편경 도·레·솔
  fortune(t) {
    const lp = this.lowpass(1600, this.out(0.9, 0.3));
    this.partial(65.4, 0.16, 2, t, lp, 0.4);
    [523.3, 587.3, 784.0].forEach((f, i) => {
      [[1, 0.15, 1.0], [2.01, 0.03, 0.5]].forEach(([r, a, d]) => this.partial(f * r, a, d, t + i * 0.34, lp, 0.015));
    });
  }

  // 죽음: 묵직한 박동 두 번, 느려진 한 번, 그리고 멈춘다
  death(t) {
    const out = this.out(1, 0.15), sat = this.ctx.createGain();
    sat.gain.value = 0.8;
    this.satLp.disconnect();
    this.satLp.connect(sat).connect(out);
    [[0, 1], [0.22, 0.7], [0.95, 0.9], [1.17, 0.6], [2.3, 0.55]].forEach(([dt, a]) => {
      this.partial(58, 0.9 * a, 0.28, t + dt, this.sat, 0.004, 0.75);
      this.noise(0.06, t + dt, this.sat, 300, 0.5 * a, 0.8);
    });
  }

  // 귀결: 부풀었다 잦아드는 징
  ending(t) {
    const out = this.out(0.8, 1);
    this.noise(0.3, t, out, 400, 0.25);
    [[1, 0.3, 4, 0.02], [1.48, 0.16, 3.2, 0.3], [1.98, 0.13, 3, 0.5], [2.61, 0.1, 2.4, 0.7], [3.43, 0.07, 2, 0.8], [4.1, 0.05, 1.6, 0.9]]
      .forEach(([r, a, d, att]) => this.partial(98 * r, a, d, t, out, att, 0.985));
  }
}
