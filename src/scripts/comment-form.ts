/* eslint-disable @typescript-eslint/no-explicit-any */
import { marked } from "marked";
import createDOMPurify from "dompurify";

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

  writeBtn!.addEventListener("click", () => setActive("write"));
  previewBtn!.addEventListener("click", () => {
    setActive("preview");
    renderPreview();
  });

  textarea!.addEventListener("input", () => {
    if (!previewPanel!.hidden) {
      renderPreview();
    }
  });
}

// Initialize all comment forms on the page
document.querySelectorAll<HTMLElement>("[data-comment-form]")
  .forEach(setupOne);
