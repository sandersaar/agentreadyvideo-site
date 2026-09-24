// Progressive enhancement only. Every page reads fine without this file.
(() => {
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // Copy buttons on code blocks.
  for (const fig of $$("figure.code")) {
    const cap = fig.querySelector("figcaption");
    const code = fig.querySelector("pre code");
    if (!cap || !code || !navigator.clipboard) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy";
    btn.textContent = "Copy";
    const file = cap.textContent.trim();
    btn.setAttribute("aria-label", file ? `Copy ${file}` : "Copy code");
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = "Copied";
        btn.dataset.done = "";
      } catch {
        btn.textContent = "Press Ctrl+C";
      }
      setTimeout(() => { btn.textContent = "Copy"; delete btn.dataset.done; }, 1800);
    });
    cap.append(btn);
  }

  // Tabs (WAI-ARIA tabs pattern, manual activation by click, arrows move focus and select).
  for (const box of $$("[data-tabs]")) {
    const tabs = $$('[role="tab"]', box);
    const select = (tab, focus) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute("aria-selected", on);
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      }
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (k) { e.preventDefault(); select(tabs[(i + k + tabs.length) % tabs.length], true); }
        if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); }
        if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
    select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  }

  // Spec contents: open on wide screens, collapsed on phones; highlight the section in view.
  const toc = document.querySelector("details.toc");
  if (toc) {
    const wide = matchMedia("(min-width: 1024px)");
    const sync = () => { toc.open = wide.matches; };
    sync();
    wide.addEventListener("change", sync);
    toc.addEventListener("click", (e) => { if (e.target.closest("a") && !wide.matches) toc.open = false; });
    const links = new Map($$("a[href^='#']", toc).map((a) => [a.getAttribute("href").slice(1), a]));
    const heads = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    if ("IntersectionObserver" in window && heads.length) {
      let current;
      const io = new IntersectionObserver((entries) => {
        for (const en of entries) if (en.isIntersecting) {
          if (current) current.removeAttribute("aria-current");
          current = links.get(en.target.id);
          current.setAttribute("aria-current", "true");
        }
      }, { rootMargin: "-80px 0px -70% 0px" });
      heads.forEach((h) => io.observe(h));
    }
  }

  // Version selector.
  for (const sel of $$("select[data-version]")) sel.addEventListener("change", () => { location.href = sel.value; });

  // Theme toggle: light, dark; remembered per browser when storage is available.
  const btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    const root = document.documentElement;
    const effective = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const label = () => btn.setAttribute("aria-label", `Switch to ${effective() === "dark" ? "light" : "dark"} theme`);
    btn.hidden = false;
    label();
    btn.addEventListener("click", () => {
      const next = effective() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("arv-theme", next); } catch {}
      label();
    });
  }
})();
