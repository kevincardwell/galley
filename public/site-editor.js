// Galley's helper inside a site preview. The preview route puts it first in <head>.
// It runs in a sandboxed frame (an opaque origin), so it can only talk to Galley through postMessage.
(() => {
  const me = document.currentScript;
  if (!me || window.parent === window) return;
  const prefix = me.dataset.prefix; // /api/site/<workspace>/<token>
  const file = me.dataset.file;
  const parentOrigin = location.protocol + "//" + location.host;
  const tell = (msg) => window.parent.postMessage(msg, parentOrigin);

  // ---- The site lives under a prefix, not at the server root: fix root-relative URLs made at runtime ----
  const fix = (u) => {
    if (typeof u !== "string" && !(u instanceof URL)) return u;
    try {
      const url = new URL(u, location.href);
      if (url.host !== location.host || url.pathname === prefix || url.pathname.startsWith(prefix + "/")) return u;
      url.pathname = prefix + url.pathname;
      return typeof u === "string" ? url.href : url;
    } catch {
      return u;
    }
  };
  const realFetch = window.fetch;
  window.fetch = (input, init) => realFetch(input instanceof Request ? input : fix(input), init);
  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return realOpen.call(this, method, fix(url), ...rest);
  };
  const ATTRS = ["src", "href", "action", "poster"];
  const fixEl = (el) => {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith(prefix + "/")) el.setAttribute(a, prefix + v);
    }
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") fixEl(r.target);
      else for (const n of r.addedNodes) if (n.nodeType === 1) [n, ...n.querySelectorAll("[src],[href],[action],[poster]")].forEach(fixEl);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS });

  // ---- Text that a page script has changed isn't the file's text: saving it would write the script's output (an
  // animation frame, a counter) into the file. So an element is only editable while it matches the page as served,
  // parsed without running its scripts; one that doesn't loses its outline. ----
  let served = null;
  const asServed = () =>
    (served ??= realFetch(location.href)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => new DOMParser().parseFromString(t, "text/html"))
      .catch(() => null));
  // ponytail: checked when editing starts; a script that rewrites the text mid-edit isn't told apart from typing.
  // Watch the active element with a MutationObserver if that ever happens.
  async function untouched(el) {
    const doc = await asServed();
    const twin = doc && doc.querySelector(`[data-galley-edit="${el.dataset.galleyEdit}"]`);
    if (twin && twin.innerHTML === el.innerHTML) return true;
    el.removeAttribute("data-galley-edit");
    return false;
  }

  // ---- Click to edit ----
  let editing = false;
  let active = null;
  let before = "";

  const css = document.createElement("style");
  css.textContent = `
    html.galley-editing [data-galley-edit] { cursor: text; }
    html.galley-editing [data-galley-edit]:hover { outline: 2px dashed rgba(47,107,79,.75); outline-offset: 3px; }
    [data-galley-edit][contenteditable] { outline: 2px solid rgb(47,107,79) !important; outline-offset: 3px; cursor: text; }
  `;

  function finish(save) {
    const el = active;
    if (!el) return;
    active = null;
    el.removeAttribute("contenteditable");
    if (!save) {
      el.innerHTML = before;
      return;
    }
    const html = el.innerHTML;
    if (html === before) return;
    const [start, end] = el.dataset.galleyEdit.split("-").map(Number);
    tell({ type: "galley:edit", file, start, end, hash: el.dataset.galleyHash, html, scrollY: window.scrollY });
  }

  function begin(el, x, y) {
    if (active === el) return;
    finish(true);
    active = el;
    before = el.innerHTML;
    el.setAttribute("contenteditable", "true");
    el.focus();
    const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (range) {
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      if (!editing) return;
      const el = e.target.closest && e.target.closest("[data-galley-edit]");
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        const { clientX: x, clientY: y } = e;
        untouched(el).then((ok) => (ok ? begin(el, x, y) : tell({ type: "galley:locked" })));
      } else if (e.target.closest && e.target.closest("a[href]")) {
        e.preventDefault(); // stay on the page while editing; links work again in preview mode
      }
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (!active) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
      e.stopPropagation();
    },
    true,
  );
  document.addEventListener("focusout", (e) => e.target === active && finish(true), true);
  document.addEventListener(
    "paste",
    (e) => {
      if (!active) return;
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData && e.clipboardData.getData("text/plain")) || "");
    },
    true,
  );
  document.addEventListener("drop", (e) => active && e.preventDefault(), true);

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || e.origin !== parentOrigin) return;
    const msg = e.data || {};
    if (msg.type === "galley:mode") {
      editing = !!msg.editing;
      document.documentElement.classList.toggle("galley-editing", editing);
      if (editing) document.querySelectorAll("[data-galley-edit]").forEach(untouched);
      else finish(true);
    } else if (msg.type === "galley:scroll") {
      window.scrollTo(0, msg.y || 0);
    }
  });

  let scrollTimer = 0;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => tell({ type: "galley:scrolled", y: window.scrollY }), 150);
    },
    { passive: true },
  );

  document.addEventListener("DOMContentLoaded", () => {
    document.head.appendChild(css);
    const path = location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) || "/" : location.pathname;
    tell({ type: "galley:page", path, file, title: document.title, editable: document.querySelectorAll("[data-galley-edit]").length });
  });
})();
