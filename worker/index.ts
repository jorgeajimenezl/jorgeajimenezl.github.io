import { Hono } from "hono";
import { cors } from "hono/cors";
import { mdToSafeHtml } from "./markdown";
import { getClientIp, isAllowedOrigin, parseOriginAllowlist, sha256Hex } from "./utils";
import { limitComment, limitPreview } from "./ratelimits";

type Env = {
  DB: D1Database
  KV: KVNamespace
  TURNSTILE_SECRET: string
  ORIGIN_ALLOWLIST?: string
}

const app = new Hono<{ Bindings: Env }>();

app.use("/*", async (c, next) => {
  const allowset = parseOriginAllowlist(c.env.ORIGIN_ALLOWLIST);
  const origin = c.req.header("Origin") || null;
  const originToUse = isAllowedOrigin(origin, allowset) ? origin! : Array.from(allowset)[0] || "*";

  return cors({
    origin: originToUse,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    maxAge: 600
  })(c, next);
});

async function verifyTurnstile(secret: string, token: string, ip?: string) {
  if (!token || !secret) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  if (!res.ok) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  return Boolean(data.success);
}

app.post("/preview", async (c) => {
  const ipAddress = getClientIp(c.req.raw);
  const rateLimits = await limitPreview(c.env.KV, ipAddress);
  if (!rateLimits.ok) {
    return c.json(
      { error: "too many previews", retryAfter: rateLimits.retryAfter }, 
      429
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const md = String(body.markdown ?? "").slice(0, 4000);
  const html = await mdToSafeHtml(md);
  return c.json({ html, schemaVersion: 1 });
});

app.get("/comments", async (c) => {
  const slug = c.req.query("slug");
  if (!slug) 
    return c.json({ error: "missing slug" }, 400);

  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const stmt = c.env.DB
    .prepare("SELECT id, author, body_html AS html, created_at FROM comments WHERE slug = ? ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .bind(slug, limit, offset);

  const { results } = await stmt.all();
  return c.json({ comments: results });
});

app.post("/comments", async (c) => {
  const ipAddress = getClientIp(c.req.raw);
  const ua = c.req.header("User-Agent") || "";

  const json = await c.req.json().catch(() => ({}));
  const slug = String(json.slug ?? "");
  const author = String(json.author ?? "");
  const body = String(json.body ?? "");
  const turnstileToken = String(json.turnstileToken ?? "");

  if (!slug || !author || !body || !turnstileToken) {
    return c.json({ error: "missing fields" }, 400);
  }

  const rateLimits = await limitComment(c.env.KV, ipAddress, slug);
  if (!rateLimits.ok) {
    return c.json(
      { error: "slow down", retryAfter: rateLimits.retryAfter }, 
      429
    );
  }

  const isTurnstileVerified = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstileToken, ipAddress);
  if (!isTurnstileVerified) 
    return c.json({ error: "turnstile failed" }, 403);

  const safeAuthor = author.trim().slice(0, 80);
  const md = body.trim().slice(0, 4000);

  const html = await mdToSafeHtml(md);

  const created = Date.now();
  const ipHash = await sha256Hex(ipAddress);

  await c.env.DB.prepare(
    "INSERT INTO comments (slug, author, body, body_html, created_at, ip_hash, ua) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(slug, safeAuthor, md, html, created, ipHash, ua.slice(0, 255)).run();

  return c.json({ ok: true });
});

app.get("/status", (c) => c.json({ ok: true }));

export default app;
