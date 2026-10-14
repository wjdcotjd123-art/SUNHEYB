// 본문 표기 규칙을 HTML로 바꾼다. **굵게**, <빨강>…</빨강> 등 색 태그.
const COLORS = { 빨강: "c-red", 보라: "c-violet", 초록: "c-jade", 금색: "c-gold" };

export function lineToHtml(line) {
  let s = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  for (const [tag, cls] of Object.entries(COLORS)) {
    s = s.replaceAll(`&lt;${tag}&gt;`, `<span class="${cls}">`).replaceAll(`&lt;/${tag}&gt;`, "</span>");
  }
  return s;
}

// 빈 줄을 기준으로 문단을 나눈다.
export function linesToHtml(lines) {
  const paras = [[]];
  for (const l of lines) l === "" ? paras.push([]) : paras[paras.length - 1].push(lineToHtml(l));
  return paras.filter((p) => p.length).map((p) => `<p>${p.join("<br>")}</p>`).join("");
}
