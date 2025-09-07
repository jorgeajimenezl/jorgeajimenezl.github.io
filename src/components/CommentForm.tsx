/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsxImportSource preact */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { marked } from "marked";
import createDOMPurify from "dompurify";

type Tab = "write" | "preview";

interface Props {
  postSlug?: string;
  parentId?: number | string;
  compact?: boolean;
  onSubmitted?: () => void;
}

interface PreviewResponse {
  html: string;
}

const API_BASE = import.meta.env?.PUBLIC_API_BASE || "";
function apiUrl(path: string) {
  if (!API_BASE) return path;
  const base = API_BASE.replace(/\/?$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function CommentForm(props: Props) {
  const [tab, setTab] = useState<Tab>("write");
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string>("<p class=\"m-0 text-black/60 dark:text-white/60\">Nothing to preview yet.</p>");
  const previewTimer = useRef<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const SITE_KEY = import.meta.env?.PUBLIC_TURNSTILE_SITE_KEY || "";
  const TURNSTILE_BYPASS = (import.meta.env?.PUBLIC_TURNSTILE_BYPASS || "").toLowerCase().trim();
  const BYPASS = TURNSTILE_BYPASS === "1" || TURNSTILE_BYPASS === "true" || TURNSTILE_BYPASS === "yes" || TURNSTILE_BYPASS === "on";
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileTokenRef = useRef<string>("");

  const DOMPurify = useMemo(() => {
    try {
      const instance = createDOMPurify(window);
      return instance as typeof createDOMPurify;
    } catch {
      return createDOMPurify;
    }
  }, []);

  function renderLocalPreview(src: string) {
    const html = marked.parse(src, { breaks: true, gfm: true }) as string;
    const safe = DOMPurify.sanitize?.(html, {
      ALLOW_DATA_ATTR: false,
      USE_PROFILES: { html: true },
    }) ?? html;
    setPreviewHtml(safe || "<p class=\"m-0 text-black/60 dark:text-white/60\">Nothing to preview yet.</p>");
  }

  async function scheduleServerPreview() {
    if (tab !== "preview") return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    const src = text.slice(0, 4000);
    if (!src) return;
    previewTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(apiUrl("/preview"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: src })
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({} as PreviewResponse));
        const serverHtml = String((data as PreviewResponse)?.html ?? "");
        if (!serverHtml) return;
        // Ignore if user changed text since scheduling
        if (text.slice(0, 4000) !== src) return;
        const safeServerHtml = DOMPurify.sanitize?.(serverHtml, {
          ALLOW_DATA_ATTR: false,
          USE_PROFILES: { html: true },
        }) as string;
        if (safeServerHtml) setPreviewHtml(safeServerHtml);
      } catch {
        // ignore network/CORS errors
      }
  }, 400);
  }

  useEffect(() => {
    if (tab === "preview") {
      renderLocalPreview(text);
      scheduleServerPreview();
    }
  }, [tab, text]);

  // Load and render Cloudflare Turnstile, if configured
  useEffect(() => {
    if (!SITE_KEY || BYPASS) return;
    function ensureScript(): Promise<void> {
      return new Promise((resolve) => {
        if ((window as any).turnstile) return resolve();
        const existing = document.querySelector<HTMLScriptElement>("script[src*=\"challenges.cloudflare.com/turnstile\"]");
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          return;
        }
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        document.head.appendChild(s);
      });
    }

    let destroyed = false;
    (async () => {
      await ensureScript();
      if (destroyed) return;
      const ts: any = (window as any).turnstile;
      if (!ts || !turnstileRef.current) return;
      ts.render(turnstileRef.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => {
          turnstileTokenRef.current = token;
          setError(null);
        },
        "error-callback": () => {
          setError("Captcha error. Please retry.");
        },
        "expired-callback": () => {
          turnstileTokenRef.current = "";
        },
      });
    })();

    return () => {
      destroyed = true;
    };
  }, [SITE_KEY]);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setOk(false);
    setError(null);
    const slug = props.postSlug || "";
    const body = text.trim();
    const name = author.trim();
    if (!slug) {
      setError("Missing post slug.");
      return;
    }
    if (!name) {
      setError("Please enter your name.");
      return;
    }
    if (!body) {
      setError("Please write a comment.");
      return;
    }
    if (SITE_KEY && !turnstileTokenRef.current && !BYPASS) {
      setError("Please complete the captcha.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/comments"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          author: name,
          body,
          parentId: props.parentId ?? null,
          turnstileToken: turnstileTokenRef.current || "",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as unknown));
        const msg = (data as any)?.error || `Failed to post (${res.status})`;
        throw new Error(String(msg));
      }
      setOk(true);
      setText("");
      // Keep author populated for convenience
      try {
        window.dispatchEvent(new CustomEvent("comments:created", { detail: { slug } }));
      } catch {
        // ignore
      }
      if (props.onSubmitted) props.onSubmitted();
    } catch (err) {
      setError((err as Error).message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  const isReply = props.parentId !== undefined && props.parentId !== null;
  const compact = Boolean(props.compact);

  return (
    <div>
      {!compact && (
        <h3 class="mt-8 text-base font-semibold text-black dark:text-white">{isReply ? "Reply" : "Leave a comment"}</h3>
      )}
      <form class="mt-3 space-y-3" onSubmit={handleSubmit}>
        <div>
          <label for="author" class="sr-only">Your name</label>
          <input
            id="author"
            name="author"
            type="text"
            value={author}
            onInput={(e) => setAuthor((e.currentTarget as HTMLInputElement).value)}
            placeholder="Your name"
            class="w-full rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-stone-900/50 p-2 text-sm text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30"
          />
        </div>
        <div class="flex items-center gap-2 border-b border-black/10 dark:border-white/10">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            aria-controls="panel-write"
            data-tab="write"
            onClick={() => setTab("write")}
            class="px-3 py-1.5 text-sm font-medium rounded-t-md text-black dark:text-white border border-b-0 border-transparent data-[active=true]:border-black/10 data-[active=true]:dark:border-white/10 data-[active=true]:bg-black/5 data-[active=true]:dark:bg-white/5"
            data-active={String(tab === "write")}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            aria-controls="panel-preview"
            data-tab="preview"
            onClick={() => setTab("preview")}
            class="px-3 py-1.5 text-sm font-medium rounded-t-md text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white border border-b-0 border-transparent data-[active=true]:border-black/10 data-[active=true]:dark:border-white/10 data-[active=true]:bg-black/5 data-[active=true]:dark:bg-white/5"
            data-active={String(tab === "preview")}
          >
            Preview
          </button>
        </div>

        {tab === "write" ? (
          <div id="panel-write" role="tabpanel">
            <label for="comment" class="sr-only">Your comment</label>
            <textarea
              id="comment"
              name="comment"
              rows={6}
              placeholder={isReply ? "Write your reply…" : "Write your comment…"}
              value={text}
              onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
              class="w-full resize-y rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-stone-900/50 p-3 text-sm text-black dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/30"
            />
          </div>
        ) : (
          <div
            id="panel-preview"
            role="tabpanel"
            class="panel-preview prose prose-sm dark:prose-invert max-w-none rounded-md border border-black/10 dark:border-white/10 bg-white/60 dark:bg-stone-900/40 p-3"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}

        {SITE_KEY && !BYPASS ? (
          <div class="flex items-center">
            <div ref={turnstileRef} />
          </div>
        ) : (
          !compact && (
            <p class="text-xs text-black/50 dark:text-white/50">
              {BYPASS 
                ? "Captcha bypass active (local/dev)."
                : "Note: Captcha not configured. Set PUBLIC_TURNSTILE_SITE_KEY to enable submissions."}
            </p>
          )
        )}

        <div class="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !author.trim() || !text.trim() || ((Boolean(SITE_KEY) && !BYPASS) && !turnstileTokenRef.current)}
            class={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium ${submitting || !author.trim() || !text.trim() || ((Boolean(SITE_KEY) && !BYPASS) && !turnstileTokenRef.current) ? "bg-black/80 text-white opacity-60 dark:bg-white/20 cursor-not-allowed" : "bg-black text-white dark:bg-white dark:text-black"}`}
          >
            {submitting ? (isReply ? "Replying…" : "Posting…") : (isReply ? "Reply" : "Post comment")}
          </button>
          <span class="text-xs text-black/50 dark:text-white/50">Don't share personal information.</span>
        </div>
        {error && (
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        {ok && !error && (
          <p class="text-sm text-green-700 dark:text-green-400">Thanks! {isReply ? "Your reply" : "Your comment"} was posted.</p>
        )}
      </form>
    </div>
  );
}
