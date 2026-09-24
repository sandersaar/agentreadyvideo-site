// Zero-dependency static build: wraps src/pages/*.html in one layout, writes JSON-LD, sitemap.xml
// and llms-full.txt, copies public/ to dist/, then runs the publishing guard.
// Spec text, schemas, examples, changelog and governance rules come from the ARV standard repo at the
// commit pinned in standard.lock.json. Run `node scripts/sync-standard.mjs` first (npm run build does).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, cpSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { loadStandard, renderSpec, changelogEntries, governance, standardsTable, SPEC_CONTENTS, SPEC_ANCHORS } from "./scripts/standard.mjs";

const root = dirname(new URL(import.meta.url).pathname);
const dist = join(root, "dist");
const STATUS = "Draft 1.0, proposed";
const SITE = "https://agentreadyvideo.org";
const SPEC = "/spec/1.0";
const REPO = "https://github.com/sandersaar/agentreadyvideo-site";
const PUBLISHED = "2026-09-23";
const UPDATED = "2026-09-24";
const OG_IMAGE = `${SITE}/og.png`;
const OG_ALT = "Agent-Ready Video (ARV). The open standard that makes video usable by AI agents. Draft 1.0, proposed.";
const CITE = `Agent-Ready Video (ARV) Specification, Draft 1.0 (proposed). AgentCDN, 2026. ${SITE}${SPEC}`;
const LICENSES = {
  spec: "https://github.com/CommunitySpecification/1.0",
  code: "https://www.apache.org/licenses/LICENSE-2.0",
  docs: "https://creativecommons.org/licenses/by/4.0/",
};

const std = loadStandard(root);
rmSync(dist, { recursive: true, force: true });
cpSync(join(root, "public"), dist, { recursive: true });
mkdirSync(join(dist, "examples/1.0"), { recursive: true });
mkdirSync(join(dist, "schema/1.0"), { recursive: true });
for (const n of std.examples) cpSync(join(std.dir, "examples/1.0", `${n}.json`), join(dist, "examples/1.0", `${n}.json`));
for (const n of std.schemas) cpSync(join(std.dir, "schemas/1.0", `${n}.schema.json`), join(dist, "schema/1.0", `${n}.schema.json`));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const plain = (html) => decode(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const exampleJson = (name) => readFileSync(join(std.dir, "examples/1.0", `${name}.json`), "utf8").trim();
const exampleObj = (name) => JSON.parse(exampleJson(name));
const codeFigure = (caption, code, lang = "") =>
  `<figure class="code"${lang ? ` data-lang="${lang}"` : ""}><figcaption><span class="file">${caption}</span></figcaption><pre tabindex="0"><code>${esc(code)}</code></pre></figure>`;
const example = (name) => codeFigure(`<a href="/examples/1.0/${name}.json">/examples/1.0/${name}.json</a>`, exampleJson(name), "json");
const LABELS = { "rights-summary-account-link": "Restricted rights summary", manifest: "Manifest", moment: "Moment", "playback-descriptor": "Playback descriptor", "usage-receipt": "Usage receipt", asset: "Asset", catalog: "Catalog", "rights-summary": "Rights summary" };
const tabs = (id, items) => `<div class="tabs" data-tabs>
<div class="tablist" role="tablist" aria-label="Example objects">
${items.map((n, i) => `<button type="button" role="tab" id="${id}-tab-${n}" aria-controls="${id}-${n}" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ""}>${LABELS[n]}</button>`).join("\n")}
</div>
${items.map((n) => `<div class="tabpanel" role="tabpanel" id="${id}-${n}" aria-labelledby="${id}-tab-${n}">${example(n)}</div>`).join("\n")}
</div>`;

const nav = [
  [SPEC, "Spec"],
  ["/quickstart", "Quick start"],
  ["/faq", "FAQ"],
  ["/implementations", "Implementations"],
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
  description: "Home of the Agent-Ready Video (ARV) standard: spec, quick start, schemas, examples, implementations, FAQ, changelog and governance.",
  inLanguage: "en",
  publisher: { "@id": ORG_ID },
};

const glossaryTerms = (body) =>
  [...body.matchAll(/<dt id="(term-[a-z-]+)">([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(([, id, name, def]) => ({ id, name: plain(name), def: plain(def) }));
const faqItems = (body) =>
  [...body.matchAll(/<section class="qa" id="([a-z0-9-]+)">\s*<h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/section>/g)].map(([, id, q, a]) => ({ id, q: plain(q), a: plain(a) }));
const howToSteps = (body) =>
  [...body.matchAll(/<h2 id="(step-[a-z0-9-]+)">([\s\S]*?)<\/h2>\s*<p>([\s\S]*?)<\/p>/g)].map(([, id, name, text]) => ({ id, name: plain(name.replace(/<span class="coming">[\s\S]*?<\/span>|<a class="anchor"[\s\S]*?<\/a>/g, "")).replace(/^\d+\.\s*/, ""), text: plain(text) }));

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
    datePublished: meta.published ?? PUBLISHED,
    dateModified: meta.updated ?? UPDATED,
  };
  const graph = [organization, website, page];
  if (!isHome) {
    page.breadcrumb = { "@id": `${url}#breadcrumb` };
    const crumbs = [{ name: "Agent-Ready Video", item: `${SITE}/` }, ...(meta.parent ? [{ name: meta.parent[1], item: `${SITE}${meta.parent[0]}` }] : []), { name: meta.crumb, item: url }];
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })),
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
  if (meta.schema === "howto") {
    const steps = howToSteps(body);
    if (steps.length < 4) throw new Error(`quick start has ${steps.length} steps; expected at least 4`);
    page.mainEntity = { "@id": `${url}#howto` };
    graph.push({
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: "Reach Agent-Ready Video (ARV) level L1 on a static site",
      description: meta.description,
      totalTime: "PT5M",
      inLanguage: "en",
      mainEntityOfPage: { "@id": `${url}#webpage` },
      step: steps.map(({ id, name, text }, i) => ({ "@type": "HowToStep", position: i + 1, name, text, url: `${url}#${id}` })),
    });
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
const LOGO = `<svg class="logo" viewBox="0 0 52 28" width="52" height="28" aria-hidden="true" focusable="false"><rect width="52" height="28" rx="6" fill="var(--accent)"/><text x="26" y="19" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="13" font-weight="700" letter-spacing="1" fill="var(--on-accent)">ARV</text></svg>`;
const GH_ICON = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

const layout = (meta, body) => {
  const { title, description, path } = meta;
  const url = `${SITE}${path}`;
  const current = (href) => path === href || (href === SPEC && path.startsWith("/spec")) ? ' aria-current="page"' : "";
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
<meta name="theme-color" content="#fbfaf7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111413" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
<link rel="alternate" type="text/plain" href="/llms-full.txt" title="llms-full.txt">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="stylesheet" href="/style.css">
<script>try{var t=localStorage.getItem("arv-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}document.documentElement.classList.add("js")</script>
<script src="/site.js" defer></script>
<script type="application/ld+json">
${jsonLd(meta, body)}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-6RW53BPVPJ"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","G-6RW53BPVPJ",{anonymize_ip:true});</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="Agent-Ready Video, home">${LOGO}<span class="brand-name">Agent-Ready Video</span></a>
    <nav class="primary" aria-label="Primary">
      ${nav.map(([href, label]) => `<a href="${href}"${current(href)}>${label}</a>`).join("\n      ")}
      <a class="gh" href="${REPO}">${GH_ICON}<span>GitHub</span></a>
      <button type="button" class="theme" data-theme-toggle aria-label="Switch color theme" hidden><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5v11a5.5 5.5 0 010-11z"/></svg></button>
    </nav>
  </div>
</header>
<main id="main" class="wrap${meta.wide ? " wide" : ""}">
${meta.nostatus ? "" : `<p class="status"><span class="dot" aria-hidden="true"></span>${STATUS}</p>\n`}${body}
</main>
<footer class="site">
  <div class="wrap foot">
    <div class="foot-cols">
      <div>
        <p>Maintainer: <a href="https://agentcdn.com">AgentCDN</a></p>
        <p>Supporters: open, join the Agent-Ready Video Community Group at W3C (proposal pending)</p>
        <p>Contact: <a href="mailto:team@agentreadyvideo.org">team@agentreadyvideo.org</a></p>
        <p>Spec text: Community Specification License 1.0. Code: Apache-2.0. Docs: CC-BY-4.0.</p>
        <p>Cite as: Agent-Ready Video (ARV) Specification, Draft 1.0. AgentCDN, 2026. <a href="${SPEC}">${SITE}${SPEC}</a></p>
      </div>
      <nav aria-label="Site index">
        <p><a href="${SPEC}">Spec 1.0</a> · <a href="/quickstart">Quick start</a> · <a href="/schema/1.0/">Schema</a> · <a href="/implementations">Implementations</a></p>
        <p><a href="/faq">FAQ</a> · <a href="/changelog">Changelog</a> · <a href="/governance">Governance</a> · <a href="${REPO}">GitHub</a></p>
        <p><a href="/llms.txt">llms.txt</a> · <a href="/llms-full.txt">llms-full.txt</a> · <a href="/sitemap.xml">Sitemap</a></p>
      </nav>
    </div>
  </div>
</footer>
</body>
</html>
`;
};

// ---------- body transforms ----------
const withCells = (body) =>
  // Give each table cell a data-label from its column header, so tables stack on phones.
  body.replace(/<table>([\s\S]*?)<\/table>/g, (t) => {
    const heads = [...t.matchAll(/<th>([\s\S]*?)<\/th>/g)].map((h) => h[1].replace(/<[^>]+>/g, ""));
    return t.replace(/<tr>([\s\S]*?)<\/tr>/g, (row, cells) =>
      /<th>/.test(cells) ? row : "<tr>" + (() => { let i = 0; return cells.replace(/<td>/g, () => `<td data-label="${heads[i++] ?? ""}">`); })() + "</tr>");
  });
// Every h2, h3 and h4 with an id gets a hover link to itself.
const withAnchors = (body) =>
  body.replace(/<(h[234]) id="([a-z0-9-]+)"([^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, id, rest, inner) =>
    /class="anchor"/.test(inner) ? all : `<${tag} id="${id}"${rest}>${inner} <a class="anchor" href="#${id}" aria-label="Link to section: ${esc(plain(inner))}">#</a></${tag}>`);
const withCode = (body) =>
  body.replace(/\{\{code ([^}]+)\}\}\n([\s\S]*?)\n\{\{\/code\}\}/g, (_, attrs, code) => {
    const a = Object.fromEntries([...attrs.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    return codeFigure(a.file ?? "", code, a.lang ?? "");
  });

// ---------- content from the standard repo ----------
const spec = renderSpec(std, codeFigure);
// Moment id rule from spec section 3.2, used to check the example ids and fill the quick start.
const momentId = (origin, assetId, startMs, endMs) => {
  const hash = createHash("sha256").update(`${origin}|${assetId}|${startMs}|${endMs}`).digest();
  let bits = "", out = "";
  for (const byte of hash) bits += byte.toString(2).padStart(8, "0");
  for (let i = 0; i + 5 <= bits.length; i += 5) out += "abcdefghijklmnopqrstuvwxyz234567"[parseInt(bits.slice(i, i + 5), 2)];
  return "mom_" + out.slice(0, 26);
};
const catalog = exampleObj("catalog");
const qsAsset = catalog.assets[0];
const qsMoment = catalog.moments[0];
const manifestL1 = (({ arv, publisher, license_url, catalogs, schema }) => ({ arv, conformance_level: "L1", publisher, license_url, catalogs, schema }))(exampleObj("manifest"));
const isoDuration = (ms) => { const s = Math.round(ms / 1000); return `PT${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}H` : ""}${Math.floor(s / 60) % 60 ? `${Math.floor(s / 60) % 60}M` : ""}${s % 60 ? `${s % 60}S` : ""}`; };
const videoJsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "@id": `${qsAsset.page_url}#video`,
  name: qsAsset.title,
  description: "How to set the idle mixture screw and check the idle speed.",
  thumbnailUrl: exampleObj("playback-descriptor").poster,
  uploadDate: "2026-09-01",
  duration: isoDuration(qsAsset.duration_ms),
  hasPart: catalog.moments.filter((m) => m.asset_id === qsAsset.id).map((m) => ({
    "@type": "Clip", "@id": m.moment_uri, name: m.title, startOffset: m.start_ms / 1000, endOffset: m.end_ms / 1000, url: m.moment_url,
  })),
};
const SCHEMA_ANCHOR = { asset: "asset", moment: "moment", "rights-summary": "rights-summary", "playback-descriptor": "playback-descriptor", "usage-receipt": "usage-receipt", manifest: "manifest", catalog: "catalog" };
const schemaTable = () => `<div class="table-wrap">
<table>
<thead><tr><th>Object</th><th>Schema</th><th>Example</th></tr></thead>
<tbody>
${[...std.schemas].sort((x, y) => ((i) => i(x) - i(y))((n) => { const k = Object.keys(SCHEMA_ANCHOR).indexOf(n); return k < 0 ? 99 : k; })).map((n) => {
  const title = JSON.parse(readFileSync(join(std.dir, "schemas/1.0", `${n}.schema.json`), "utf8")).title.replace(/^ARV /, "");
  const exs = std.examples.filter((e) => e === n || e.startsWith(`${n}-`)).sort((x, y) => (x === n ? -1 : y === n ? 1 : x.localeCompare(y)));
  const obj = SCHEMA_ANCHOR[n] ? `<a href="${SPEC}#${SCHEMA_ANCHOR[n]}">${esc(title)}</a>` : esc(title);
  return `<tr><td>${obj}</td><td><a href="/schema/1.0/${n}.schema.json"><code>${SITE}/schema/1.0/${n}.schema.json</code></a></td><td>${exs.map((e) => `<a href="/examples/1.0/${e}.json">${e}.json</a>`).join(", ") || "None"}</td></tr>`;
}).join("\n")}
</tbody>
</table>
</div>`;
const CHANGELOG_TITLES = {
  Unreleased: "Public source repository",
  "2026-09-24": "Entitlement and payment fields, site launch, registrations",
  "2026-09-23": "Draft 1.0 proposed",
};
const changelogList = () => `<ol class="changelog">
${changelogEntries(std).map(({ date, items }) => {
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const id = dated ? date : date.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<li>
${dated ? `<time datetime="${date}">${date}</time>` : `<span class="when">${esc(date)}</span>`}
<h2 id="${id}">${esc(CHANGELOG_TITLES[date] ?? date)}</h2>
<ul>
${items.map((i) => `  <li>${i}</li>`).join("\n")}
</ul>
</li>`;
}).join("\n")}
</ol>`;
const macros = (body) => body
  .replace(/\{\{spec:(toc|conventions|glossary|sections|changes)\}\}/g, (_, k) => spec[k])
  .replace(/\{\{standards-table\}\}/g, () => standardsTable(std, "table-wrap bindings"))
  .replace(/\{\{schema-table\}\}/g, schemaTable)
  .replace(/\{\{changelog\}\}/g, changelogList)
  .replace(/\{\{governance:([^}]+)\}\}/g, (_, t) => governance(std, t))
  .replace(/\{\{json:catalog\}\}/g, () => exampleJson("catalog"))
  .replace(/\{\{json:manifest-l1\}\}/g, () => JSON.stringify(manifestL1, null, 2))
  .replace(/\{\{json:video-jsonld\}\}/g, () => JSON.stringify(videoJsonLd, null, 2))
  .replace(/\{\{mid:call\}\}/g, () => `"${catalog.origin}", "${qsMoment.asset_id}", ${qsMoment.start_ms}, ${qsMoment.end_ms}`)
  .replace(/\{\{mid:id\}\}/g, () => momentId(catalog.origin, qsMoment.asset_id, qsMoment.start_ms, qsMoment.end_ms))
  .replace(/\{\{std:(repo|sha|short)\}\}/g, (_, k) => std[k]);

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
  let body = macros(raw.slice(m[0].length))
    .replace(/\{\{example:([a-z-]+)\}\}/g, (_, n) => example(n))
    .replace(/\{\{tabs:([a-z]+):([a-z,-]+)\}\}/g, (_, id, list) => tabs(id, list.split(",")))
    .replace(/\{\{cite\}\}/g, CITE)
    .replace(/\{\{repo\}\}/g, REPO);
  body = withAnchors(withCells(withCode(body)));
  const out = join(dist, meta.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, layout(meta, body));
  pages.push({ ...meta, body });
  console.log("built", meta.out);
}

// ---------- sitemap.xml ----------
const order = ["/", SPEC, "/quickstart", "/faq", "/implementations", "/schema/1.0/", "/changelog", "/governance"];
const rank = (p) => (order.includes(p) ? order.indexOf(p) : 99);
pages.sort((a, b) => rank(a.path) - rank(b.path));
writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE}${p.path}</loc><lastmod>${p.updated ?? UPDATED}</lastmod></url>`).join("\n")}
</urlset>
`);
console.log("built sitemap.xml");

// ---------- llms-full.txt: the full spec (and FAQ) as plain Markdown ----------
const toMarkdown = (html, base) => {
  let t = html
    .replace(/<!--nomd-->[\s\S]*?<!--\/nomd-->/g, "")
    .replace(/<figure class="code"[^>]*><figcaption>[\s\S]*?href="([^"]+)"[\s\S]*?<\/figcaption><pre[^>]*><code>([\s\S]*?)<\/code><\/pre><\/figure>/g,
      (_, href, code) => `\n\nExample (${SITE}${href}):\n\n\`\`\`json\n${decode(code)}\n\`\`\`\n\n`)
    .replace(/<ol(?: class="[^"]*")?(?: start="(\d+)")?>([\s\S]*?)<\/ol>/g, (_, start, items) => {
      let n = Number(start ?? 1);
      return "\n" + items.replace(/<li[^>]*>/g, () => `\n${n++}. `).replace(/<\/li>/g, "") + "\n\n";
    })
    .replace(/ ?<a class="anchor"[^>]*>#<\/a>/g, "")
    .replace(/<nav class="toc"[\s\S]*?<\/nav>/g, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, "\n\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, "\n\n### $1\n\n")
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, "\n\n#### $1\n\n")
    .replace(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g, "\n- **$1**: $2")
    .replace(/<li[^>]*>/g, "\n- ").replace(/<\/li>/g, "")
    .replace(/<\/(p|ul|ol|dl|table|div|section)>/g, "\n\n")
    .replace(/<tr>/g, "\n- ").replace(/<\/t[dh]>\s*<t[dh][^>]*>/g, " | ")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/g, "`$1`")
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, "**$2**")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href, text) => `[${text}](${href.startsWith("/") ? SITE + href : href.startsWith("#") ? SITE + base + href : href})`)
    .replace(/<[^>]+>/g, "");
  const parts = t.split(/(```json[\s\S]*?```)/);
  const tidy = (p) => decode(p).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}(?=(- |\d+\. ))/g, (m, _, off, s) => (/\n(- |\d+\. )[^\n]*$/.test(s.slice(0, off)) ? "\n" : m));
  return parts.map((p, i) => (i % 2 ? p : tidy(p))).join("").replace(/\n{3,}/g, "\n\n").trim();
};
const specPage = pages.find((p) => p.path === SPEC);
const faq = pages.find((p) => p.path === "/faq");
writeFileSync(join(dist, "llms-full.txt"), `# Agent-Ready Video (ARV): full specification text

> ${STATUS}. Published ${PUBLISHED}, updated ${UPDATED}. Canonical URL: ${SITE}${SPEC}. Maintained by AgentCDN. Spec text: Community Specification License 1.0.
> Source: ${std.repo} at commit ${std.sha}.
> Suggested citation: ${CITE}

${toMarkdown(specPage.body, SPEC)}

---

${toMarkdown(faq.body, "/faq")}
`);
console.log("built llms-full.txt");

// ---------- guard ----------
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const banned = [/—/, /\bARVP\b/, /Agent-Ready Video Protocol/i, /Agent-Readable/i, /\bBitmovin\b/i, /ReReview|Red Bull|CNET|NOAA/i];
const llms = readFileSync(join(dist, "llms.txt"), "utf8");
const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const redirects = new Map((vercel.redirects ?? []).map((r) => [r.source, r.destination]));
// Resolve a site path the way Vercel does with cleanUrls: redirects first, then file, .html, or index.html.
const resolve = (p) => {
  if (redirects.has(p)) p = redirects.get(p);
  const clean = p.replace(/\/$/, "");
  for (const c of [p, `${clean}.html`, `${clean}/index.html`]) {
    const f = join(dist, c);
    if (existsSync(f) && !f.endsWith("/")) try { readFileSync(f); return f; } catch {}
  }
  return null;
};
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const required = [SPEC, "/quickstart", "/faq", "/implementations", "/governance", "/changelog"];
for (const f of walk(dist)) {
  if (!/\.(html|txt|json|css|svg|xml|js)$/.test(f)) continue;
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
  if (!llms.includes(`(${canon[1]})`)) fail(`llms.txt does not list ${canon[1]}`);
  if (!sitemap.includes(`<loc>${canon[1]}</loc>`)) fail(`sitemap.xml does not list ${canon[1]}`);
  if (resolve(canon[1].slice(SITE.length)) !== f) fail(`canonical ${canon[1]} does not resolve to this file`);
  if (!/<meta property="og:image" content="https:\/\/[^"]+">/.test(t)) fail("missing og:image");
  const h1s = (t.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) fail(`expected one <h1>, found ${h1s}`);
  let prev = 1;
  for (const [, lv] of t.matchAll(/<h([1-6])[\s>]/g)) {
    if (+lv > prev + 1) fail(`heading jumps from h${prev} to h${lv}`);
    prev = +lv;
  }
  for (const [, id] of t.matchAll(/<h[2-6] id="([^"]+)"/g)) if (!t.includes(`href="#${id}"`)) fail(`heading #${id} has no anchor link`);
  for (const href of required) if (!t.includes(`href="${href}"`)) fail(`no link to ${href}`);
  const own = ids(t);
  const dup = [...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) !== i);
  if (dup.length) fail(`duplicate ids: ${dup.join(", ")}`);
  for (const [, href] of t.matchAll(/href="([^"]+)"/g)) {
    if (/^(https?:|mailto:)/.test(href)) continue;
    const [p, frag] = href.split("#");
    if (!p) { if (frag && !own.has(frag)) fail(`broken fragment #${frag}`); continue; }
    const target = resolve(p);
    if (!target) fail(`broken link ${href}`);
    if (frag && target.endsWith(".html") && !ids(readFileSync(target, "utf8")).has(frag)) fail(`broken link ${href}`);
  }
  for (const [, ld] of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(ld); } catch (e) { fail(`JSON-LD does not parse: ${e.message}`); }
  }
}
for (const [src, dst] of redirects) if (!resolve(dst)) throw new Error(`redirect ${src} -> ${dst} has no target`);

// Standard repo checks: schema $id equals its URL here, examples parse, moment ids recompute,
// every spec contents entry exists, and vercel.json serves schemas as application/schema+json.
const schemaFiles = walk(join(dist, "schema")).filter((f) => f.endsWith(".schema.json"));
if (schemaFiles.length !== std.schemas.length || !schemaFiles.length) throw new Error(`expected ${std.schemas.length} schema files in dist/schema, found ${schemaFiles.length}`);
for (const f of schemaFiles) {
  let s;
  try { s = JSON.parse(readFileSync(f, "utf8")); } catch (e) { throw new Error(`${f}: schema does not parse: ${e.message}`); }
  const url = SITE + f.slice(dist.length);
  if (s.$id !== url) throw new Error(`${f}: $id ${s.$id} does not equal its URL ${url}`);
}
const schemaRule = (vercel.headers ?? []).find((h) => new RegExp("^" + h.source.replace(/\(\.\*\)/g, ".*") + "$").test("/schema/1.0/moment.schema.json"));
if (!schemaRule?.headers.some((x) => x.key === "Content-Type" && x.value.startsWith("application/schema+json"))) throw new Error("vercel.json does not serve /schema/1.0/*.schema.json as application/schema+json");
const exampleFiles = walk(join(dist, "examples")).filter((f) => f.endsWith(".json"));
if (exampleFiles.length !== std.examples.length || !exampleFiles.length) throw new Error(`expected ${std.examples.length} examples in dist/examples, found ${exampleFiles.length}`);
for (const f of exampleFiles) {
  let ex;
  try { ex = JSON.parse(readFileSync(f, "utf8")); } catch (e) { throw new Error(`${f}: example does not parse: ${e.message}`); }
  for (const mo of ex.moments ?? (ex.moment_uri && ex.start_ms !== undefined && ex.asset_id ? [ex] : [])) {
    if (mo.id && mo.id !== momentId(catalog.origin, mo.asset_id, mo.start_ms, mo.end_ms)) throw new Error(`${f}: moment id ${mo.id} does not recompute`);
  }
}
{
  const html = readFileSync(join(dist, "spec/1.0/index.html"), "utf8");
  const toc = html.match(/<nav aria-label="Specification contents">([\s\S]*?)<\/nav>/)?.[1] ?? "";
  const have = ids(html);
  for (const id of SPEC_CONTENTS) {
    if (!toc.includes(`href="#${id}"`)) throw new Error(`spec contents lacks section #${id}`);
    if (!have.has(id)) throw new Error(`spec section #${id} referenced by the contents is missing`);
  }
  for (const id of SPEC_ANCHORS) if (!have.has(id)) throw new Error(`spec anchor #${id} is missing`);
  for (const [, id] of toc.matchAll(/href="#([^"]+)"/g)) if (!have.has(id)) throw new Error(`spec contents links #${id}, which is missing`);
}
console.log("guard ok");
