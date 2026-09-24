// Writes public/og.svg and renders it to public/og.png (1200x630) with headless Chrome.
// Run by hand when the card text changes: node scripts/og-image.mjs. The PNG is committed.
import { writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const root = join(dirname(new URL(import.meta.url).pathname), "..");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#111413"/>
  <rect x="0" y="0" width="12" height="630" fill="#6fd1b5"/>
  <rect x="96" y="120" width="112" height="56" rx="10" fill="#6fd1b5"/>
  <text x="152" y="159" text-anchor="middle" font-family="Menlo, monospace" font-size="28" font-weight="700" fill="#111413" letter-spacing="2">ARV</text>
  <text x="96" y="300" font-family="Inter, -apple-system, Helvetica, Arial, sans-serif" font-size="84" font-weight="700" fill="#e8ebe9">Agent-Ready Video</text>
  <text x="96" y="380" font-family="Inter, -apple-system, Helvetica, Arial, sans-serif" font-size="38" fill="#a3aba7">The open standard that makes video usable by AI agents.</text>
  <text x="96" y="530" font-family="Menlo, monospace" font-size="28" fill="#f2c26b">Draft 1.0, proposed</text>
  <text x="1104" y="530" text-anchor="end" font-family="Menlo, monospace" font-size="28" fill="#a3aba7">agentreadyvideo.org</text>
</svg>
`;
writeFileSync(join(root, "public/og.svg"), svg);

const chromes = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const chrome = chromes.find((p) => existsSync(p));
if (!chrome) throw new Error("no Chrome found; og.svg written, og.png not refreshed");
const dir = mkdtempSync(join(tmpdir(), "arv-og-"));
const html = join(dir, "og.html");
writeFileSync(html, `<!doctype html><html><body style="margin:0">${svg}</body></html>`);
const out = join(root, "public/og.png");
try {
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${join(dir, "profile")}`, "--window-size=1200,630", `--screenshot=${out}`, `file://${html}`,
  ], { stdio: "ignore", timeout: 30000 });
} catch (e) {
  // Chrome on macOS can linger after writing the screenshot; the timeout kills it.
  if (!existsSync(out)) throw e;
}
console.log("wrote public/og.svg and public/og.png");
