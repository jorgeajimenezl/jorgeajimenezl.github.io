import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";
import rehypeStringify from "rehype-stringify";
import { sanitizeSchema } from "./sanitizeSchema";

/**
 * Convert user Markdown into sanitized HTML.
 * - Raw HTML in Markdown is dropped (allowDangerousHtml: false)
 * - Links: target=_blank + rel=nofollow ugc noopener noreferrer
 * - Images are removed by the sanitize schema
 */
export async function mdToSafeHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype, { allowDangerousHtml: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .use(rehypeSanitize, sanitizeSchema as any)
    .use(rehypeExternalLinks, {
      target: "_blank",
      rel: ["nofollow", "ugc", "noopener", "noreferrer"]
    })
    .use(rehypeStringify)
    .process(md);

  return String(file);
}
