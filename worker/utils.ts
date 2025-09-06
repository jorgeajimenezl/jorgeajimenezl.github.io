export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function getClientIp(req: Request): string {
  // Cloudflare edge sets this header
  return req.headers.get("CF-Connecting-IP") ?? "";
}

export function parseOriginAllowlist(csv?: string): Set<string> {
  if (!csv) return new Set();
  return new Set(csv.split(",").map(s => s.trim()).filter(Boolean));
}

export function isAllowedOrigin(origin: string | null, allow: Set<string>): boolean {
  if (!origin) return false;
  return allow.has(origin);
}
