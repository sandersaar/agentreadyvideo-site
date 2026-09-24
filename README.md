# agentreadyvideo-site

Source for agentreadyvideo.org, the public home of the Agent-Ready Video (ARV) standard. Status: Draft 1.0, proposed. Maintained by AgentCDN.

- `src/pages/*.html`: page bodies. The first line is JSON front matter.
- `public/`: copied as is (styles, `site.js`, `llms.txt`, `examples/1.0/*.json`). `site.js` only enhances: copy buttons, tabs, the spec contents and the theme toggle. Every page reads fine without it.
- `src/pages/*.html`: front matter needs `title`, `description`, `path`, `out`, and `crumb` on inner pages. `"schema": "techarticle"` (spec), `"schema": "faq"` (FAQ) and `"schema": "howto"` (quick start) add TechArticle, DefinedTermSet, FAQPage and HowTo JSON-LD, read from the page's glossary, Q&A sections and `step-*` headings. Macros: `{{example:name}}`, `{{tabs:id:a,b}}`, `{{code file="..." lang="..."}}...{{/code}}`, `{{cite}}`, `{{repo}}`.
- The spec lives at `/spec/1.0` (`src/pages/spec-1.0.html`). `/spec` redirects to the latest version and `/adopt` to `/quickstart` (`vercel.json`). A new version gets a new page and path; published versions never change.
- `node build.mjs`: zero-dependency build into `dist/`. It writes per-page meta, Open Graph, Twitter and JSON-LD tags, `sitemap.xml` and `llms-full.txt`. It fails on em dashes, banned names, a missing title, description or canonical, a canonical that does not resolve to its file, more than one H1, skipped heading levels, a heading without an anchor link, duplicate ids, a broken internal link or fragment, missing links to spec, quick start, FAQ, implementations, governance or changelog, JSON-LD that does not parse, or a page not listed in `llms.txt` and `sitemap.xml`.
- `node scripts/serve.mjs [port]`: zero-dependency preview of `dist/` that applies the `vercel.json` redirects, clean URLs and headers.
- `node scripts/og-image.mjs`: redraws `public/og.svg` and renders `public/og.png` (1200x630) with local Chrome. Run it by hand when the card text changes.

Deploys on Vercel (`vercel.json`). Licenses: spec text Community Specification License 1.0, code Apache-2.0, docs CC-BY-4.0.
