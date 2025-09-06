/* eslint-disable @typescript-eslint/no-explicit-any */
import { marked } from "marked";
import createDOMPurify from "dompurify";

// API base from Astro public env (empty means same-origin)
const API_BASE = import.meta.env?.PUBLIC_API_BASE || "";
function apiUrl(path: string) {
  if (!API_BASE) return path;
  const base = API_BASE.replace(/\/?$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// Ensure we have a DOMPurify instance in the browser
const DOMPurify: any = typeof createDOMPurify === "function" && !(createDOMPurify as any).sanitize
  ? (createDOMPurify as any)(window)
  : (createDOMPurify as any);

function setupOne(root: HTMLElement) {
  const writeBtn = root.querySelector<HTMLButtonElement>("button[data-tab=\"write\"]");
  const previewBtn = root.querySelector<HTMLButtonElement>("button[data-tab=\"preview\"]");
  const writePanel = root.querySelector<HTMLElement>("#panel-write");
  const previewPanel = root.querySelector<HTMLElement>("#panel-preview");
  const textarea = root.querySelector<HTMLTextAreaElement>("#comment");

  if (!writeBtn || !previewBtn || !writePanel || !previewPanel || !textarea) return;

  function setActive(tab: "write" | "preview") {
    const isWrite = tab === "write";
    writeBtn!.setAttribute("aria-selected", String(isWrite));
    previewBtn!.setAttribute("aria-selected", String(!isWrite));
    (writeBtn as any).dataset.active = String(isWrite);
    (previewBtn as any).dataset.active = String(!isWrite);
    writePanel!.hidden = !isWrite;
    previewPanel!.hidden = isWrite;
  }

  function renderPreview() {
    const src = textarea!.value ?? "";
    const html = marked.parse(src, { breaks: true, gfm: true }) as string;
    previewPanel!.innerHTML = DOMPurify.sanitize(html, {
      ALLOW_DATA_ATTR: false,
      USE_PROFILES: { html: true },
    }) || "<p class=\"m-0 text-black/60 dark:text-white/60\">Nothing to preview yet.</p>";
  }

  // Debounced server-side preview check (falls back silently if API is unreachable)
  let previewTimer: number | undefined;
  function scheduleServerPreview() {
    if (!previewPanel || previewPanel.hidden) return;
    if (previewTimer) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(async () => {
      const src = (textarea!.value ?? "").slice(0, 4000);
      if (!src) return;
      try {
        const res = await fetch(apiUrl("/preview"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: src })
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({} as any));
        const serverHtml = String((data as any)?.html ?? "");
        if (!serverHtml) return;
        // Ignore if the textarea changed since the request was scheduled
        if ((textarea!.value ?? "").slice(0, 4000) !== src) return;
        const safeServerHtml = DOMPurify.sanitize(serverHtml, {
          ALLOW_DATA_ATTR: false,
          USE_PROFILES: { html: true },
        }) as string;
        if (safeServerHtml && safeServerHtml.trimEnd() !== previewPanel!.innerHTML.trimEnd()) {
          console.debug("Using server-side preview");
          console.log({ safeServerHtml, prev: previewPanel!.innerHTML });
          previewPanel!.innerHTML = safeServerHtml;
        }
      } catch {
        // Network or CORS issue — ignore; keep local preview
      }
    }, 400);
  }

  writeBtn!.addEventListener("click", () => setActive("write"));
  previewBtn!.addEventListener("click", () => {
    setActive("preview");
    renderPreview();
    scheduleServerPreview();
  });

  textarea!.addEventListener("input", () => {
    if (!previewPanel!.hidden) {
      renderPreview();
      scheduleServerPreview();
    }
  });
}

// Initialize all comment forms on the page
document.querySelectorAll<HTMLElement>("[data-comment-form]")
  .forEach(setupOne);
