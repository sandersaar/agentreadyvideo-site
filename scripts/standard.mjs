// Reads the ARV standard repo snapshot in vendor/standard/ (written by sync-standard.mjs at the
// commit pinned in standard.lock.json) and renders its Markdown into the site's HTML shapes.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, posix } from "node:path";
import { markdown, inline, esc } from "./markdown.mjs";

export const SPEC_FILES = ["01-purpose.md", "02-scope.md", "03-core-objects.md", "04-bindings.md", "05-conformance.md"];
// Stable site anchors, keyed by section number or, for unnumbered headings, by heading text.
const IDS = {
  "1": "purpose", "1.1": "one-manifest", "1.2": "standards", "1.3": "name",
  "2": "scope", "2.1": "in-scope", "2.2": "out-of-scope", "2.3": "moment-address",
  "3": "objects", "3.1": "asset", "3.2": "moment", "3.3": "rights-summary", "3.3.1": "entitlement-payment",
  "3.4": "playback-descriptor", "3.5": "usage-receipt", "3.6": "manifest", "3.7": "catalog",
  "4": "bindings", "4.1": "crawl-time", "4.2": "inference-time", "4.3": "playback",
  "5": "conformance", "5.1": "l1", "5.2": "l2", "5.3": "l3", "5.4": "badge",
};
const TEXT_IDS = { "Forbidden-field rule (normative)": "forbidden-fields" };
// Every entry of the spec contents. The build fails if one is missing from the page or the contents.
export const SPEC_CONTENTS = ["top", "conventions", "glossary", ...Object.values(IDS).filter((id) => !["entitlement-payment"].includes(id)), "changes", "cite"];
export const SPEC_ANCHORS = [...SPEC_CONTENTS, "entitlement-payment", "forbidden-fields"];

const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
const ghSlug = (s) => s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s/g, "-");

export function loadStandard(root) {
  const lock = JSON.parse(readFileSync(join(root, "standard.lock.json"), "utf8"));
  if (!/^[0-9a-f]{40}$/.test(lock.commit ?? "")) throw new Error("standard.lock.json has no full commit SHA");
  const dir = join(root, "vendor/standard");
  const srcFile = join(dir, "SOURCE.json");
  if (!existsSync(srcFile)) throw new Error("vendor/standard/ is missing. Run: node scripts/sync-standard.mjs");
  const src = JSON.parse(readFileSync(srcFile, "utf8"));
  if (src.commit !== lock.commit) throw new Error(`vendor/standard/ is at ${src.commit}, lock says ${lock.commit}. Run: node scripts/sync-standard.mjs`);
  const read = (rel) => readFileSync(join(dir, rel), "utf8");
  const list = (rel, re) => readdirSync(join(dir, rel)).filter((f) => re.test(f)).sort();
  const repo = lock.repo.replace(/\.git$/, "").replace(/\/$/, "");
  return {
    repo, sha: lock.commit, short: lock.commit.slice(0, 7), dir, read,
    examples: list("examples/1.0", /\.json$/).map((f) => f.replace(/\.json$/, "")),
    schemas: list("schemas/1.0", /\.schema\.json$/).map((f) => f.replace(/\.schema\.json$/, "")),
    blob: (rel) => `${repo}/blob/${lock.commit}/${rel}`,
  };
}

// Split a Markdown file into its "## " sections: [{ title, body }].
const sections = (src) => src.split(/^## /m).slice(1).map((s) => { const nl = s.indexOf("\n"); return { title: s.slice(0, nl).trim(), body: s.slice(nl + 1) }; });
const section = (src, title, file) => {
  const s = sections(src).find((x) => x.title === title);
  if (!s) throw new Error(`${file} has no "## ${title}" section`);
  return s.body;
};

// Link rewriting for files in the repo: spec files become in-page anchors, schemas and examples
// become their URLs on this site, anything else points at the file on GitHub at the pinned commit.
function linker(std, base, anchors, file) {
  return (href) => {
    if (/^(https?:|mailto:)/.test(href)) return href;
    const [p, frag] = href.split("#");
    const target = p ? posix.normalize(posix.join(base, p)) : posix.join(base, file);
    const spec = /^spec\/1\.0\/(.+\.md)$/.exec(target);
    if (spec && anchors[spec[1]]) {
      const id = frag ? anchors[spec[1]].gh[frag] : anchors[spec[1]].top;
      if (!id) throw new Error(`${file}: link ${href} has no matching section`);
      return `#${id}`;
    }
    let m;
    if ((m = /^schemas\/1\.0\/([a-z-]+\.schema\.json)$/.exec(target))) return `/schema/1.0/${m[1]}`;
    if ((m = /^examples\/1\.0\/([a-z-]+\.json)$/.exec(target))) return `/examples/1.0/${m[1]}`;
    if (/^(schemas|examples)\/1\.0\/?$/.test(target)) return "/schema/1.0/";
    return `${std.repo}/${/\.\w+$/.test(target) ? "blob" : "tree"}/${std.sha}/${target}${frag ? `#${frag}` : ""}`;
  };
}

// Heading ids and numbers for every spec file, computed before rendering so links can cross files.
function specHeadings(std) {
  const anchors = {}, plan = {};
  for (const file of SPEC_FILES) {
    const src = std.read(`spec/1.0/${file}`);
    const heads = [];
    let fence = false, top = null, n2 = 0;
    for (const line of src.split("\n")) {
      if (/^```/.test(line)) fence = !fence;
      const m = !fence && /^(#{1,3})\s+(.+?)\s*$/.exec(line);
      if (!m) continue;
      const level = m[1].length;
      const num = /^(\d+(?:\.\d+)*)\.?\s+(.*)$/.exec(m[2]);
      let text = m[2], key = num?.[1];
      if (level === 1) top = key;
      if (level === 2) { n2++; if (!num && top) { key = `${top}.${n2}`; text = `${key} ${m[2]}`; } }
      const id = IDS[key] ?? TEXT_IDS[m[2]] ?? slug(m[2]);
      heads.push({ level, raw: m[2], text, key, id });
    }
    if (!heads.length || heads[0].level !== 1) throw new Error(`spec/1.0/${file} does not start with a "# " heading`);
    anchors[file] = { top: heads[0].id, gh: Object.fromEntries(heads.map((h) => [ghSlug(h.raw), h.id])) };
    plan[file] = heads;
  }
  return { anchors, plan };
}

export function renderSpec(std, codeFigure) {
  const { anchors, plan } = specHeadings(std);
  const table = (cls) => (html) => `<div class="${cls}">\n${html}\n</div>`;
  const code = (lang, body, prev) => {
    const ex = [...prev.matchAll(/href="(\/examples\/1\.0\/[a-z-]+\.json)"/g)].pop();
    const caption = ex ? `<a href="${ex[1]}">${ex[1]}</a>` : esc(lang || "code");
    return codeFigure(caption, body, lang);
  };
  const html = [];
  const toc = [];
  for (const file of SPEC_FILES) {
    const heads = [...plan[file]];
    const body = markdown(std.read(`spec/1.0/${file}`), {
      link: linker(std, "spec/1.0", anchors, file),
      heading: (level) => { const h = heads.shift(); return { tag: `h${level + 1}`, id: h.id, text: h.text }; },
      code, table: table("table-wrap"), olClass: file === "05-conformance.md" ? "checks" : undefined,
    });
    html.push(body);
    const [h1, ...rest] = plan[file];
    const subs = rest.filter((h) => h.level === 2);
    toc.push(`  <li><a href="#${h1.id}">${inline(h1.text)}</a>${subs.length ? `\n    <ol>\n${subs.map((h) => `      <li><a href="#${h.id}">${inline(h.text)}</a></li>`).join("\n")}\n    </ol>\n  ` : ""}</li>`);
  }
  const readme = std.read("spec/1.0/README.md");
  const readmeLink = linker(std, "spec/1.0", anchors, "README.md");
  const conventions = markdown(section(readme, "Conventions", "spec/1.0/README.md"), { link: readmeLink });
  const termsSrc = section(readme, "Key terms", "spec/1.0/README.md");
  const terms = [...termsSrc.matchAll(/^- \*\*(.+?)\*\*:\s*(.+)$/gm)];
  if (terms.length < 7) throw new Error(`spec/1.0/README.md Key terms lists ${terms.length} terms; expected at least 7`);
  const intro = markdown(termsSrc.replace(/^- .*$/gm, "").trim(), { link: readmeLink });
  const glossary = `${intro}\n<dl class="glossary">\n${terms.map(([, t, d]) => `  <dt id="term-${slug(t)}">${inline(t)}</dt>\n  <dd>${inline(d.replace(/^./, (c) => c.toUpperCase()), readmeLink)}</dd>`).join("\n")}\n</dl>`;
  const changes = `<ul>\n${changelogEntries(std).map((e) => `  <li><strong>${esc(e.date)}.</strong>\n    <ul>\n${e.items.map((i) => `      <li>${i}</li>`).join("\n")}\n    </ul>\n  </li>`).join("\n")}\n</ul>`;
  return { toc: toc.join("\n"), conventions, glossary, sections: html.join("\n\n"), changes };
}

export function changelogEntries(std) {
  const link = linker(std, "", {}, "CHANGELOG.md");
  const entries = sections(std.read("CHANGELOG.md")).map(({ title, body }) => ({
    date: title,
    items: [...body.matchAll(/^- (.+)$/gm)].map((m) => inline(m[1], link)),
  }));
  if (!entries.length) throw new Error("CHANGELOG.md has no entries");
  return entries;
}

export function governance(std, title) {
  return markdown(section(std.read("GOVERNANCE.md"), title, "GOVERNANCE.md"), { link: linker(std, "", {}, "GOVERNANCE.md") });
}

export function standardsTable(std, cls) {
  const src = section(std.read("spec/1.0/01-purpose.md"), "1.2 What ARV adds to each standard", "spec/1.0/01-purpose.md");
  const t = markdown(src.split("\n").filter((l) => l.startsWith("|")).join("\n"), { table: (h) => `<div class="${cls}">\n${h}\n</div>` });
  if (!t.includes("<table>")) throw new Error("spec/1.0/01-purpose.md section 1.2 has no table");
  return t;
}
