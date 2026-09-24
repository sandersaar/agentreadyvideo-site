// Fetches the pinned commit of the ARV standard repo (standard.lock.json) as a GitHub tarball and
// extracts the spec, schemas, examples, conformance checklist, changelog and governance into
// vendor/standard/. No git and no dependencies at build time. Any failure exits non-zero.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { gunzipSync } from "node:zlib";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const out = join(root, "vendor/standard");
const KEEP = [/^spec\/1\.0\/[^/]+\.md$/, /^schemas\/1\.0\/[^/]+\.schema\.json$/, /^examples\/1\.0\/[^/]+\.json$/, /^conformance\/README\.md$/, /^CHANGELOG\.md$/, /^GOVERNANCE\.md$/];

const die = (msg) => { console.error(`sync-standard: ${msg}`); process.exit(1); };
let lock;
try { lock = JSON.parse(readFileSync(join(root, "standard.lock.json"), "utf8")); } catch (e) { die(`cannot read standard.lock.json: ${e.message}`); }
const sha = lock.commit;
if (!/^[0-9a-f]{40}$/.test(sha ?? "")) die("standard.lock.json has no full 40-character commit SHA");
const m = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(lock.repo ?? "");
if (!m) die("standard.lock.json repo must be a https://github.com/<owner>/<repo> URL");
const url = `https://codeload.github.com/${m[1]}/${m[2]}/tar.gz/${sha}`;

let gz;
try {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) die(`GET ${url} returned ${res.status}`);
  gz = Buffer.from(await res.arrayBuffer());
} catch (e) { die(`GET ${url} failed: ${e.message}`); }
let tar;
try { tar = gunzipSync(gz); } catch (e) { die(`tarball does not gunzip: ${e.message}`); }

// Minimal ustar reader with pax headers (GitHub tarballs use both).
const str = (b, o, n) => b.toString("utf8", o, o + n).replace(/\0.*$/s, "");
const pax = (body) => Object.fromEntries(
  [...body.toString("utf8").matchAll(/\d+ ([^=]+)=([^\n]*)\n/g)].map((x) => [x[1], x[2]]));
const files = new Map();
let commentSha = null, next = {};
for (let off = 0; off + 512 <= tar.length; ) {
  const h = tar.subarray(off, off + 512);
  if (h.every((x) => x === 0)) break;
  const size = parseInt(str(h, 124, 12).trim() || "0", 8);
  const type = String.fromCharCode(h[156] || 48);
  const body = tar.subarray(off + 512, off + 512 + size);
  off += 512 + Math.ceil(size / 512) * 512;
  if (type === "g") { commentSha = pax(body).comment ?? commentSha; continue; }
  if (type === "x") { next = pax(body); continue; }
  const name = next.path ?? ((str(h, 345, 155) ? str(h, 345, 155) + "/" : "") + str(h, 0, 100));
  next = {};
  if (type !== "0" && type !== "\0") continue;
  const rel = name.split("/").slice(1).join("/");
  if (KEEP.some((re) => re.test(rel))) files.set(rel, Buffer.from(body));
}
if (commentSha && commentSha !== sha) die(`tarball is commit ${commentSha}, lock says ${sha}`);
for (const need of ["CHANGELOG.md", "GOVERNANCE.md", "conformance/README.md", "spec/1.0/README.md"])
  if (!files.has(need)) die(`tarball lacks ${need}`);
for (const dir of ["spec/1.0/", "schemas/1.0/", "examples/1.0/"])
  if (![...files.keys()].some((k) => k.startsWith(dir))) die(`tarball has nothing under ${dir}`);

rmSync(out, { recursive: true, force: true });
for (const [rel, buf] of files) {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  writeFileSync(join(out, rel), buf);
}
writeFileSync(join(out, "SOURCE.json"), JSON.stringify({ repo: lock.repo, commit: sha, files: [...files.keys()].sort() }, null, 2) + "\n");
console.log(`sync-standard: ${files.size} files from ${lock.repo} at ${sha.slice(0, 7)} into vendor/standard/`);
