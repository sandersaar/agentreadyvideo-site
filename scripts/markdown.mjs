// Small Markdown to HTML converter for the ARV source files. It covers what those files use:
// ATX headings, paragraphs, flat bullet and numbered lists, pipe tables, fenced code, code spans,
// bold, links and autolinks. Hooks let the caller choose heading ids, rewrite links and render code.
export const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function inline(text, link = (h) => h) {
  const held = [];
  const hold = (html) => `\u0000${held.push(html) - 1}\u0000`;
  const a = (href, label) => hold(`<a href="${esc(link(href))}">${label}</a>`);
  let t = text.replace(/`([^`]+)`/g, (_, c) => hold(`<code>${esc(c)}</code>`));
  t = esc(t)
    .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, u) => a(u, u))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => a(href.replace(/&amp;/g, "&"), label))
    .replace(/https?:\/\/[^\s<\u0000]+[^\s<\u0000.,;:)]/g, (u) => a(u.replace(/&amp;/g, "&"), u))
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
  while (/\u0000\d+\u0000/.test(t)) t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => held[i]);
  return t;
}

// opts.heading(level, text) -> { tag, id, text }; opts.link(href) -> href; opts.code(lang, code, prevHtml) -> html;
// opts.olClass -> class for numbered lists; opts.table(html) -> html.
export function markdown(src, opts = {}) {
  const link = opts.link ?? ((h) => h);
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const para = [];
  const flush = () => { if (para.length) { out.push(`<p>${inline(para.join(" "), link)}</p>`); para.length = 0; } };
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    let m;
    if (!line.trim()) { flush(); i++; continue; }
    if ((m = /^```(\w*)\s*$/.exec(line))) {
      flush();
      const body = [];
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      if (i >= lines.length) throw new Error("unclosed code fence");
      i++;
      const code = body.join("\n");
      out.push(opts.code ? opts.code(m[1], code, out[out.length - 1] ?? "") : `<pre><code>${esc(code)}</code></pre>`);
      continue;
    }
    if ((m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))) {
      flush();
      const h = opts.heading ? opts.heading(m[1].length, m[2]) : { tag: `h${m[1].length}`, text: m[2] };
      if (h) out.push(`<${h.tag}${h.id ? ` id="${h.id}"` : ""}>${inline(h.text ?? m[2], link)}</${h.tag}>`);
      i++;
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      flush();
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim(), link));
      const head = cells(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\|.*\|\s*$/.test(lines[i]); i++) rows.push(cells(lines[i]));
      const html = `<table>\n<thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead>\n<tbody>\n${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table>`;
      out.push(opts.table ? opts.table(html) : html);
      continue;
    }
    if ((m = /^(\s*)([-*]|\d+\.)\s+/.exec(line))) {
      flush();
      const ordered = /\d/.test(m[2]);
      const start = ordered ? parseInt(m[2], 10) : 1;
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const im = /^\s*(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(lines[i]);
        if (im) items.push(im[1]);
        else items[items.length - 1] += " " + lines[i].trim();
        i++;
      }
      const cls = ordered && opts.olClass ? ` class="${opts.olClass}"` : "";
      const tag = ordered ? `ol${cls}${start !== 1 ? ` start="${start}"` : ""}` : "ul";
      out.push(`<${tag}>\n${items.map((t) => `  <li>${inline(t, link)}</li>`).join("\n")}\n</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flush();
  return out.join("\n");
}
