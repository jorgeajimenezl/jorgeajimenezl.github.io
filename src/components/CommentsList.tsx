/* eslint-disable @typescript-eslint/no-explicit-any */
/** @jsxImportSource preact */
import { useEffect, useState } from "preact/hooks";
import CommentForm from "@components/CommentForm";

type CommentFromApi = {
  id: string | number;
  author: string;
  html: string;
  created_at: number;
  parent_id?: number | string | null;
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

type Node = CommentFromApi & { children: Node[] };

function buildTree(flat: CommentFromApi[]): Node[] {
  const byId = new Map<string | number, Node>();
  const roots: Node[] = [];
  for (const c of flat) {
    byId.set(c.id, { ...c, children: [] });
  }
  for (const c of flat) {
    const node = byId.get(c.id)!;
    const pid = c.parent_id;
    if (pid === null || pid === undefined || String(pid).trim() === "") {
      roots.push(node);
    } else {
      const parent = byId.get(pid as any);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  function sortNodes(arr: Node[]) {
    arr.sort((a, b) => a.created_at - b.created_at);
    for (const n of arr) sortNodes(n.children);
  }
  sortNodes(roots);
  return roots;
}

export default function CommentsList({ postSlug }: Props) {
  const [comments, setComments] = useState<CommentFromApi[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replyOpenFor, setReplyOpenFor] = useState<string | number | null>(null);
  
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
          <CommentTree
            nodes={buildTree(comments)}
            depth={0}
            postSlug={postSlug}
            replyOpenFor={replyOpenFor}
            onToggleReply={(id) => setReplyOpenFor((cur) => (cur === id ? null : id))}
          />
        )}
      </section>
    </>
  );
}

function CommentTree({ nodes, depth, postSlug, replyOpenFor, onToggleReply }: {
  nodes: Node[];
  depth: number;
  postSlug: string;
  replyOpenFor: string | number | null;
  onToggleReply: (id: string | number) => void;
}) {
  if (!nodes.length) return null as any;
  return (
    <ul class="space-y-4">
      {nodes.map((n) => (
        <li id={String(n.id)} class="">
          <div class={`rounded-lg border border-black/10 dark:border-white/10 p-4 ${depth > 0 ? "bg-black/[0.015] dark:bg-white/[0.03]" : ""}`}>
            <div class="flex items-center gap-2 mb-2">
              <span class="font-medium text-sm text-black dark:text-white">{n.author}</span>
              <span class="text-black/40 dark:text-white/40">•</span>
              <span class="text-sm text-black/60 dark:text-white/60">
                <time dateTime={new Date(n.created_at).toISOString()}>
                  {new Date(n.created_at).toLocaleDateString("en-us", { month: "short", day: "numeric", year: "numeric" })}
                </time>
              </span>
              <button
                type="button"
                onClick={() => onToggleReply(n.id)}
                class="ml-auto text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white underline"
              >
                {replyOpenFor === n.id ? "Cancel" : "Reply"}
              </button>
            </div>
            <div class="panel-preview prose prose-sm dark:prose-invert m-0" dangerouslySetInnerHTML={{ __html: n.html }} />
            {replyOpenFor === n.id && (
              <div class="mt-3">
                <CommentForm postSlug={postSlug} parentId={n.id} compact onSubmitted={() => onToggleReply(n.id)} />
              </div>
            )}
          </div>
          {n.children.length > 0 && (
            <div class="mt-3 ml-5 pl-3 border-l border-black/10 dark:border-white/10">
              <CommentTree 
                nodes={n.children} 
                depth={depth + 1} 
                postSlug={postSlug} 
                replyOpenFor={replyOpenFor} 
                onToggleReply={onToggleReply} 
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
