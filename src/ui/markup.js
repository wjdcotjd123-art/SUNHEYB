// 본문 표기 규칙을 HTML로 바꾼다. **굵게**, <red>…</red> 등 색 태그.
// 색 태그: red(위험·피해) purple(독·마기) green(획득·상승) gold(기연·희귀)
const COLORS = ["red", "purple", "green", "gold"];

export function lineToHtml(line) {
  let s = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  for (const c of COLORS) {
    s = s.replaceAll(`&lt;${c}&gt;`, `<span class="c-${c}">`).replaceAll(`&lt;/${c}&gt;`, "</span>");
  }
  return s;
}

// 빈 줄을 기준으로 문단을 나눈다.
export function linesToHtml(lines) {
  const paras = [[]];
  for (const l of lines) l === "" ? paras.push([]) : paras[paras.length - 1].push(lineToHtml(l));
  return paras.filter((p) => p.length).map((p) => `<p>${p.join("<br>")}</p>`).join("");
}
