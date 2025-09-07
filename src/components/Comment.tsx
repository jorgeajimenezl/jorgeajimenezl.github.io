/** @jsxImportSource preact */
export interface CommentProps {
  id?: string | number;
  author: string;
  createdAt: number;
  html: string;
}

export default function Comment({ id, author, createdAt, html }: CommentProps) {
  const iso = new Date(createdAt).toISOString();
  const label = new Date(createdAt).toLocaleDateString("en-us", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <li class="rounded-lg border border-black/10 dark:border-white/10 p-4" id={id ? String(id) : undefined}>
      <div class="flex items-center gap-2 mb-2">
        <span class="font-medium text-black dark:text-white">{author}</span>
        <span class="text-black/40 dark:text-white/40">•</span>
        <span class="text-sm text-black/60 dark:text-white/60">
          <time dateTime={iso}>{label}</time>
        </span>
      </div>
      <div class="panel-preview prose prose-sm dark:prose-invert m-0" dangerouslySetInnerHTML={{ __html: html }} />
    </li>
  );
}

