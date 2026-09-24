// Zero-dependency static build: wraps src/pages/*.html in one layout, writes JSON-LD, sitemap.xml
// and llms-full.txt, copies public/ to dist/, then runs the publishing guard.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const root = dirname(new URL(import.meta.url).pathname);
const dist = join(root, "dist");
const STATUS = "Draft 1.0, proposed";
const SITE = "https://agentreadyvideo.org";
const PUBLISHED = "2026-09-23";
const UPDATED = "2026-09-23";
const OG_IMAGE = `${SITE}/og.png`;
const OG_ALT = "Agent-Ready Video (ARV). The open standard that makes video usable by AI agents. Draft 1.0, proposed.";
const LICENSES = {
  spec: "https://github.com/CommunitySpecification/1.0",
  code: "https://www.apache.org/licenses/LICENSE-2.0",
  docs: "https://creativecommons.org/licenses/by/4.0/",
};

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "public"), dist, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const plain = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const exampleJson = (name) => readFileSync(join(root, "public/examples/1.0", `${name}.json`), "utf8").trim();
const example = (name) =>
  `<figure class="code"><figcaption><a href="/examples/1.0/${name}.json">/examples/1.0/${name}.json</a></figcaption><pre><code>${esc(exampleJson(name))}</code></pre></figure>`;

const nav = [
  ["/spec", "Spec"],
  ["/schema/1.0/", "Schema"],
  ["/adopt", "Adopt"],
  ["/faq", "FAQ"],
  ["/governance", "Governance"],
];

// ---------- JSON-LD ----------
const ORG_ID = `${SITE}/#maintainer`;
const WEBSITE_ID = `${SITE}/#website`;
const organization = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "AgentCDN",
  url: "https://agentcdn.com",
  description: "Maintainer of the Agent-Ready Video (ARV) specification, schemas and validator.",
  contactPoint: { "@type": "ContactPoint", email: "team@agentreadyvideo.org", contactType: "specification feedback" },
};
const website = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: `${SITE}/`,
  name: "Agent-Ready Video",
  alternateName: "ARV",
  description: "Home of the Agent-Ready Video (ARV) standard: spec, schemas, examples, FAQ and governance.",
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
};

const glossaryTerms = (body) =>
  [...body.matchAll(/<dt id="(term-[a-z-]+)">([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(([, id, name, def]) => ({ id, name: plain(name), def: plain(def) }));
const faqItems = (body) =>
  [...body.matchAll(/<section class="qa" id="([a-z0-9-]+)">\s*<h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/section>/g)].map(([, id, q, a]) => ({ id, q: plain(q), a: plain(a) }));

function jsonLd(meta, body) {
  const url = `${SITE}${meta.path}`;
  const isHome = meta.path === "/";
  const page = {
    "@type": meta.schema === "faq" ? "FAQPage" : "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: meta.title,
    description: meta.description,
    inLanguage: "en",
    isPartOf: { "@id": WEBSITE_ID },
    primaryImageOfPage: { "@type": "ImageObject", url: OG_IMAGE, width: 1200, height: 630 },
    datePublished: PUBLISHED,
    dateModified: UPDATED,
  };
  const graph = [organization, website, page];
  if (!isHome) {
    page.breadcrumb = { "@id": `${url}#breadcrumb` };
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Agent-Ready Video", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: meta.crumb, item: url },
      ],
    });
  }
  if (meta.schema === "faq") {
    const items = faqItems(body);
    if (items.length < 12) throw new Error(`FAQ has ${items.length} questions; expected at least 12`);
    page.mainEntity = items.map(({ id, q, a }) => ({
      "@type": "Question",
      "@id": `${url}#${id}`,
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    }));
  }
  if (meta.schema === "techarticle") {
    const terms = glossaryTerms(body);
    if (terms.length < 7) throw new Error(`glossary has ${terms.length} terms; expected at least 7`);
    const setId = `${url}#glossary`;
    page.mainEntity = { "@id": `${url}#spec` };
    graph.push(
      {
        "@type": "TechArticle",
        "@id": `${url}#spec`,
        headline: "Agent-Ready Video (ARV) Specification",
        alternativeHeadline: "ARV Draft 1.0, proposed",
        name: "Agent-Ready Video (ARV) Specification",
        description: meta.description,
        url,
        version: "1.0",
        creativeWorkStatus: "Draft, proposed",
        datePublished: PUBLISHED,
        dateModified: UPDATED,
        inLanguage: "en",
        image: OG_IMAGE,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        maintainer: { "@id": ORG_ID },
        license: LICENSES.spec,
        isPartOf: { "@id": WEBSITE_ID },
        mainEntityOfPage: { "@id": `${url}#webpage` },
        proficiencyLevel: "Expert",
        about: { "@id": setId },
      },
      {
        "@type": "DefinedTermSet",
        "@id": setId,
        name: "Agent-Ready Video (ARV) glossary",
        url: `${url}#glossary`,
        hasDefinedTerm: terms.map(({ id, name, def }) => ({
          "@type": "DefinedTerm",
          "@id": `${url}#${id}`,
          name,
          description: def,
          url: `${url}#${id}`,
          inDefinedTermSet: { "@id": setId },
        })),
      },
    );
  }
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 1).replace(/</g, "\\u003c");
}

// ---------- layout ----------
const layout = (meta, body) => {
  const { title, description, path } = meta;
  const url = `${SITE}${path}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${meta.schema === "techarticle" ? "article" : "website"}">
<meta property="og:site_name" content="Agent-Ready Video (ARV)">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<meta name="twitter:image:alt" content="${esc(OG_ALT)}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<link rel="alternate" type="text/plain" href="/llms-full.txt" title="llms-full.txt">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">
${jsonLd(meta, body)}
</script>
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
    <p>Maintainer: <a href="https://agentcdn.com">AgentCDN</a></p>
    <p>Supporters: open, join the Agent-Ready Video Community Group at W3C (proposal pending)</p>
    <p>Contact: <a href="mailto:team@agentreadyvideo.org">team@agentreadyvideo.org</a></p>
    <p>Spec text: Community Specification License 1.0. Code: Apache-2.0. Docs: CC-BY-4.0.</p>
    <p>Cite as: Agent-Ready Video (ARV) Specification, Draft 1.0. AgentCDN, 2026. <a href="${SITE}/spec">${SITE}/spec</a></p>
    <p><a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a> · <a href="/spec">Spec</a> · <a href="/schema/1.0/">Schema</a> · <a href="/adopt">Adopt</a> · <a href="/faq">FAQ</a> · <a href="/governance">Governance</a> · <a href="/sitemap.xml">Sitemap</a></p>
  </div>
</footer>
</body>
</html>
`;
};

// ---------- pages ----------
const pages = [];
for (const file of readdirSync(join(root, "src/pages")).sort()) {
  if (!file.endsWith(".html")) continue;
  const raw = readFileSync(join(root, "src/pages", file), "utf8");
  const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\n/);
  if (!m) throw new Error(`missing front matter in ${file}`);
  const meta = JSON.parse(m[1]);
  for (const k of ["title", "description", "path", "out"]) if (!meta[k]?.trim()) throw new Error(`${file}: front matter lacks ${k}`);
  if (meta.path !== "/" && !meta.crumb) throw new Error(`${file}: front matter lacks crumb`);
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
  pages.push({ ...meta, body });
  console.log("built", meta.out);
}

// ---------- sitemap.xml ----------
const order = ["/", "/spec", "/faq", "/adopt", "/schema/1.0/", "/governance"];
pages.sort((a, b) => (order.indexOf(a.path) + 99) % 99 - (order.indexOf(b.path) + 99) % 99);
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.updated ?? UPDATED}</lastmod></url>`).join("\n")}
</urlset>
`);
console.log("built sitemap.xml");

// ---------- llms-full.txt: the full spec (and FAQ) as plain Markdown ----------
const toMarkdown = (html) => {
  let t = html
    .replace(/<figure class="code"><figcaption>[\s\S]*?href="([^"]+)"[\s\S]*?<\/figcaption><pre><code>([\s\S]*?)<\/code><\/pre><\/figure>/g,
      (_, href, code) => `\n\nExample (${SITE}${href}):\n\n\`\`\`json\n${decode(code)}\n\`\`\`\n\n`)
    .replace(/<ol(?: class="[^"]*")?(?: start="(\d+)")?>([\s\S]*?)<\/ol>/g, (_, start, items) => {
      let n = Number(start ?? 1);
      return "\n" + items.replace(/<li[^>]*>/g, () => `\n${n++}. `).replace(/<\/li>/g, "") + "\n\n";
    })
    .replace(/<a class="anchor"[^>]*>#<\/a>/g, "")
    .replace(/<nav class="toc"[\s\S]*?<\/nav>/g, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, "\n\n### $1\n\n")
    .replace(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g, "\n- **$1**: $2")
    .replace(/<li[^>]*>/g, "\n- ").replace(/<\/li>/g, "")
    .replace(/<\/(p|ul|ol|dl|table|div|section)>/g, "\n\n")
    .replace(/<tr>/g, "\n- ").replace(/<\/t[dh]>\s*<t[dh][^>]*>/g, " | ")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, "`$1`")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, "**$2**")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => `[${text}](${href.startsWith("/") ? SITE + href : href.startsWith("#") ? SITE + "/spec" + href : href})`)
    .replace(/<[^>]+>/g, "");
  const parts = t.split(/(```json[\s\S]*?```)/);
  const tidy = (p) => decode(p).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}(?=(- |\d+\. ))/g, (m, _, off, s) => (/\n(- |\d+\. )[^\n]*$/.test(s.slice(0, off)) ? "\n" : m));
  return parts.map((p, i) => (i % 2 ? p : tidy(p))).join("").replace(/\n{3,}/g, "\n\n").trim();
};
const spec = pages.find((p) => p.path === "/spec");
const faq = pages.find((p) => p.path === "/faq");
writeFileSync(join(dist, "llms-full.txt"), `# Agent-Ready Video (ARV): full specification text

> ${STATUS}. Published ${PUBLISHED}. Canonical URL: ${SITE}/spec. Maintained by AgentCDN. Spec text: Community Specification License 1.0.
> Suggested citation: Agent-Ready Video (ARV) Specification, Draft 1.0 (proposed). AgentCDN, 2026. ${SITE}/spec

${toMarkdown(spec.body)}

---

${toMarkdown(faq.body)}
`);
console.log("built llms-full.txt");

// ---------- guard ----------
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const banned = [/—/, /\bARVP\b/, /Agent-Ready Video Protocol/i, /\bBitmovin\b/i, /ReReview|Red Bull|CNET|NOAA/i];
const llms = readFileSync(join(dist, "llms.txt"), "utf8");
for (const f of walk(dist)) {
  if (!/\.(html|txt|json|css|svg|xml)$/.test(f)) continue;
  const t = readFileSync(f, "utf8");
  for (const re of banned) if (re.test(t)) throw new Error(`banned text ${re} in ${f}`);
  const en = t.match(/.{0,12}–.{0,12}/g) || [];
  for (const hit of en) if (!/\d\s*–\s*\d/.test(hit)) throw new Error(`en dash outside a numeric range in ${f}: ${hit}`);
  if (!f.endsWith(".html")) continue;
  const fail = (msg) => { throw new Error(`${f}: ${msg}`); };
  if (!/<title>[^<]{10,}<\/title>/.test(t)) fail("missing or empty <title>");
  const desc = t.match(/<meta name="description" content="([^"]*)">/);
  if (!desc || desc[1].trim().length < 50) fail("missing or short meta description");
  const canon = t.match(/<link rel="canonical" href="([^"]+)">/);
  if (!canon || !canon[1].startsWith(`${SITE}/`)) fail(`missing canonical on ${SITE}`);
  if (!llms.includes(canon[1])) fail(`llms.txt does not list ${canon[1]}`);
  if (!/<meta property="og:image" content="https:\/\/[^"]+">/.test(t)) fail("missing og:image");
  const h1s = (t.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) fail(`expected one <h1>, found ${h1s}`);
  let prev = 1;
  for (const [, lv] of t.matchAll(/<h([1-6])[\s>]/g)) {
    if (+lv > prev + 1) fail(`heading jumps from h${prev} to h${lv}`);
    prev = +lv;
  }
  for (const href of ["/spec", "/faq", "/adopt", "/governance"]) if (!t.includes(`href="${href}"`)) fail(`no link to ${href}`);
  for (const [, ld] of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(ld); } catch (e) { fail(`JSON-LD does not parse: ${e.message}`); }
  }
}
console.log("guard ok");
