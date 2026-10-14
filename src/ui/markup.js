// 본문 표기 규칙을 HTML로 바꾼다. **굵게**, <red>…</red> 등 색 태그,
// {용어} 또는 {용어|보이는글} → 마우스를 올리면 풀이가 뜨는 단어.
// 색 태그: red(위험·피해) purple(독·마기) green(획득·상승) gold(기연·희귀)
const COLORS = ["red", "purple", "green", "gold"];

export function lineToHtml(line) {
  let s = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  for (const c of COLORS) {
    s = s.replaceAll(`&lt;${c}&gt;`, `<span class="c-${c}">`).replaceAll(`&lt;/${c}&gt;`, "</span>");
  }
  s = s.replace(/\{([^{}|]+)(?:\|([^{}]+))?\}/g, (_, term, shown) => `<span class="term" tabindex="0" data-term="${term}">${shown ?? term}</span>`);
  return s;
}

// 줄 간격 규칙: 문장이 끝난 줄(. ? ! … " 등으로 끝남)마다 한 문단, 문단 사이 간격은 모두 같다.
// 문장이 안 끝난 줄은 다음 줄과 이어 붙인다(강제 개행 없음). 원본의 빈 줄은 무시한다.
const SENTENCE_END = /[.?!…"”'’」』)~]$/;
const plain = (l) => l.replace(/\*\*/g, "").replace(/<\/?(red|purple|green|gold)>/g, "").replace(/[{}]/g, "").trim();
export function linesToHtml(lines) {
  const paras = [];
  let buf = [];
  for (const l of lines) {
    if (l === "") continue;
    buf.push(lineToHtml(l));
    if (SENTENCE_END.test(plain(l))) { paras.push(buf.join(" ")); buf = []; }
  }
  if (buf.length) paras.push(buf.join(" "));
  return paras.map((p) => `<p>${p}</p>`).join("");
}
