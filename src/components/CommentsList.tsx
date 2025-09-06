/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import Comment from "@components/Comment";

type CommentFromApi = {
  id: string | number;
  author: string;
  html: string;
  created_at: number;
};

interface Props {
  postSlug: string;
}

const API_BASE = import.meta.env?.PUBLIC_API_BASE || "";
function apiUrl(path: string) {
  if (!API_BASE) return path;
  const base = API_BASE.replace(/\/?$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function CommentsList({ postSlug }: Props) {
  const [comments, setComments] = useState<CommentFromApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  async function fetchAll(): Promise<CommentFromApi[]> {
    const limit = 50;
    let page = 1;
    const all: CommentFromApi[] = [];
    for (;;) {
      const url = apiUrl(`/comments?slug=${encodeURIComponent(postSlug)}&page=${page}&limit=${limit}`);
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`Failed to load comments (${res.status})`);
      const data = (await res.json()) as { comments?: CommentFromApi[] };
      const batch = Array.isArray(data.comments) ? data.comments : [];
      all.push(...batch);
      if (batch.length < limit) break;
      page += 1;
    }
    return all;
  }

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        const all = await fetchAll();
        if (!cancelled) setComments(all);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Failed to load comments");
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [postSlug]);

  useEffect(() => {
    function onCreated(e: Event) {
      const detail = (e as CustomEvent).detail as any;
      if (!detail || detail.slug !== postSlug) return;
      fetchAll()
        .then((all) => setComments(all))
        .catch((err) => setError((err as Error).message || "Failed to load comments"));
    }
    window.addEventListener("comments:created", onCreated as any);
    return () => window.removeEventListener("comments:created", onCreated as any);
  }, [postSlug]);

  return (
    <>
      <div class="my-12 border-t border-black/10 dark:border-white/10" />
      <section aria-labelledby="comments-title" class="mt-8">
        <h2 id="comments-title" class="text-xl font-semibold text-black dark:text-white mb-4">
          Comments
        </h2>

        {error ? (
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : comments === null ? (
          <p class="text-sm text-black/60 dark:text-white/60">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p class="text-sm text-black/60 dark:text-white/60">No comments yet.</p>
        ) : (
          <ul class="space-y-6">
            {comments.map((c) => (
              <Comment id={c.id} author={c.author} createdAtSeconds={c.created_at} html={c.html} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
