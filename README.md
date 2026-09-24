# agentreadyvideo-site

Source for agentreadyvideo.org, the public home of the Agent-Ready Video (ARV) standard. Status: Draft 1.0, proposed. Maintained by AgentCDN.

- `src/pages/*.html`: page bodies. The first line is JSON front matter.
- `public/`: copied as is (styles, `llms.txt`, `examples/1.0/*.json`).
- `src/pages/*.html`: front matter needs `title`, `description`, `path`, `out`, and `crumb` on inner pages. `"schema": "techarticle"` (spec) and `"schema": "faq"` (FAQ) add TechArticle, DefinedTermSet and FAQPage JSON-LD, read from the page's glossary and Q&A sections.
- `node build.mjs`: zero-dependency build into `dist/`. It writes per-page meta, Open Graph, Twitter and JSON-LD tags, `sitemap.xml` and `llms-full.txt`. It fails on em dashes, banned names, a missing title, description or canonical, more than one H1, skipped heading levels, missing links to spec, FAQ, adopt or governance, JSON-LD that does not parse, or a page not listed in `llms.txt`.
- `node scripts/og-image.mjs`: redraws `public/og.svg` and renders `public/og.png` (1200x630) with local Chrome. Run it by hand when the card text changes.

Deploys on Vercel (`vercel.json`). Licenses: spec text Community Specification License 1.0, code Apache-2.0, docs CC-BY-4.0.
