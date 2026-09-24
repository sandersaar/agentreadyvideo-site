// Zero-dependency static build: wraps src/pages/*.html in one layout and copies public/ to dist/.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const root = dirname(new URL(import.meta.url).pathname);
const dist = join(root, "dist");
const STATUS = "Draft 1.0, proposed";
const SITE = "https://agentreadyvideo.org";

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "public"), dist, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const example = (name) => {
  const json = readFileSync(join(root, "public/examples/1.0", `${name}.json`), "utf8").trim();
  return `<figure class="code"><figcaption><a href="/examples/1.0/${name}.json">/examples/1.0/${name}.json</a></figcaption><pre><code>${esc(json)}</code></pre></figure>`;
};

const nav = [
  ["/spec", "Spec"],
  ["/schema/1.0/", "Schema"],
  ["/adopt", "Adopt"],
  ["/governance", "Governance"],
];

const layout = ({ title, description, path }, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap bar">
    <a class="brand" href="/"><span class="mark" aria-hidden="true">ARV</span><span class="brand-name">Agent-Ready Video</span></a>
    <nav aria-label="Primary">
      ${nav.map(([href, label]) => `<a href="${href}"${path === href ? ' aria-current="page"' : ""}>${label}</a>`).join("\n      ")}
    </nav>
  </div>
</header>
<main id="main" class="wrap">
<p class="status"><span class="dot" aria-hidden="true"></span>${STATUS}</p>
${body}
</main>
<footer class="site">
  <div class="wrap foot">
    <p>Maintained by <a href="https://agentcdn.com">AgentCDN</a>. Contact: <a href="mailto:team@agentreadyvideo.org">team@agentreadyvideo.org</a></p>
    <p>Spec text: Community Specification License 1.0. Code: Apache-2.0. Docs: CC-BY-4.0.</p>
    <p><a href="/llms.txt">llms.txt</a> · <a href="/spec">Spec</a> · <a href="/schema/1.0/">Schema</a> · <a href="/adopt">Adopt</a> · <a href="/governance">Governance</a></p>
  </div>
</footer>
</body>
</html>
`;

for (const file of readdirSync(join(root, "src/pages"))) {
  if (!file.endsWith(".html")) continue;
  const raw = readFileSync(join(root, "src/pages", file), "utf8");
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\n/);
  if (!m) throw new Error(`missing front matter in ${file}`);
  const meta = JSON.parse(m[1]);
  let body = raw.slice(m[0].length).replace(/\{\{example:([a-z-]+)\}\}/g, (_, n) => example(n));
  // Give each table cell a data-label from its column header, so tables stack on phones.
  body = body.replace(/<table>([\s\S]*?)<\/table>/g, (t) => {
    const heads = [...t.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((h) => h[1].replace(/<[^>]+>/g, ""));
    return t.replace(/<tr>([\s\S]*?)<\/tr>/g, (row, cells) =>
      /<th>/.test(cells) ? row : "<tr>" + (() => { let i = 0; return cells.replace(/<td>/g, () => `<td data-label="${heads[i++] ?? ""}">`); })() + "</tr>");
  });
  const out = join(dist, meta.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, layout(meta, body));
  console.log("built", meta.out);
}

// Guard: no em dashes or stray en dashes in anything we publish.
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const banned = [/—/, /\bARVP\b/, /Agent-Ready Video Protocol/i, /\bBitmovin\b/i, /ReReview|Red Bull|CNET|NOAA/i];
for (const f of walk(dist)) {
  if (!/\.(html|txt|json|css|svg)$/.test(f)) continue;
  const t = readFileSync(f, "utf8");
  for (const re of banned) if (re.test(t)) throw new Error(`banned text ${re} in ${f}`);
  const en = t.match(/.{0,12}–.{0,12}/g) || [];
  for (const hit of en) if (!/\d\s*–\s*\d/.test(hit)) throw new Error(`en dash outside a numeric range in ${f}: ${hit}`);
}
console.log("guard ok");
