// Zero-dependency preview server for dist/. Mirrors vercel.json: redirects, cleanUrls and headers.
// Usage: node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const dist = join(root, "dist");
const cfg = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const port = Number(process.argv[2] ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };
const isFile = (f) => { try { return statSync(f).isFile(); } catch { return false; } };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const r = (cfg.redirects ?? []).find((x) => x.source === path);
  if (r) { res.writeHead(r.permanent ? 308 : 307, { Location: r.destination }); return res.end(); }
  if (cfg.cleanUrls && path.endsWith(".html")) { res.writeHead(308, { Location: path.replace(/(index)?\.html$/, "") }); return res.end(); }
  const clean = path.replace(/\/$/, "");
  const file = [join(dist, path), join(dist, `${clean}.html`), join(dist, clean, "index.html")].find(isFile);
  if (!file) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("404"); }
  const headers = { "Content-Type": types[extname(file)] ?? "application/octet-stream" };
  for (const h of cfg.headers ?? []) {
    const re = new RegExp("^" + h.source.replace(/\(\.\*\)/g, ".*") + "$");
    if (re.test(path)) for (const { key, value } of h.headers) headers[key] = value;
  }
  res.writeHead(200, headers);
  res.end(readFileSync(file));
}).listen(port, () => console.log(`serving dist on http://localhost:${port}`));
