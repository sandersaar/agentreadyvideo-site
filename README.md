# agentreadyvideo-site

Source for agentreadyvideo.org, the public home of the Agent-Ready Video (ARV) standard. Status: Draft 1.0, proposed. Maintained by AgentCDN.

- `src/pages/*.html`: page bodies. The first line is JSON front matter.
- `public/`: copied as is (styles, `llms.txt`, `examples/1.0/*.json`).
- `node build.mjs`: zero-dependency build into `dist/`. It fails on em dashes and banned names.

Deploys on Vercel (`vercel.json`). Licenses: spec text Community Specification License 1.0, code Apache-2.0, docs CC-BY-4.0.
