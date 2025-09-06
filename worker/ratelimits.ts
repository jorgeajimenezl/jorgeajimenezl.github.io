import { sha256Hex } from "./utils";

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

/**
 * KV-backed guard where intervals are specified in **milliseconds**.
 * Stores the last-hit timestamp as epoch.
 */
export async function touchGuard(
  kv: KVNamespace,
  key: string,
  minIntervalMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    const last = await kv.get<number>(key, "json").catch(() => null);
    console.log({ last, now, minIntervalMs });

    if (last && (now - last) < minIntervalMs) {
      const retryAfter = minIntervalMs - (now - last); // ms
      return { ok: false, retryAfter };
    }

    await kv.put(key, JSON.stringify(now), {
      expirationTtl: Math.max(Math.ceil(minIntervalMs / 1000), 60),
    });
    return { ok: true };
  } catch {
    return { ok: false, retryAfter: 60 * 1000 }; // 1 minute
  }
}

export async function limitPreview(kv: KVNamespace, ip: string): Promise<RateLimitResult> {
  const key = `rate-limit:render:${await sha256Hex(ip)}`;
  return touchGuard(kv, key, 1_000);
}

export async function limitComment(
  kv: KVNamespace,
  ip: string,
  slug: string
): Promise<RateLimitResult> {
  const key = `rate-limit:comment:${await sha256Hex(ip + "|" + slug)}`;
  return touchGuard(kv, key, 30_000);
}
