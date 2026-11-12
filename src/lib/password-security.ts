/**
 * Breached-password screening for NEW account registration only.
 *
 * Uses the Have I Been Pwned "Pwned Passwords" range API with k-anonymity:
 *  - SHA-1 is computed locally with Web Crypto.
 *  - Only the first 5 hex characters of the hash are sent to HIBP.
 *  - The returned suffixes are compared locally.
 * The plaintext password and the full hash never leave the device, and nothing
 * here logs, stores or reports them.
 *
 * This is an application-level preflight, NOT equivalent to Supabase's native
 * server-enforced Leaked Password Protection. See docs/PASSWORD_SCREENING.md.
 */

export type ScreenResult =
  | { status: "safe" }
  | { status: "breached"; count: number }
  | { status: "unavailable"; reason: "no_crypto" | "network" | "timeout" | "http" | "malformed" };

export const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const PREFIX_RE = /^[0-9A-F]{5}$/;
const LINE_RE = /^([0-9A-F]{35}):(\d{1,12})$/;
const MAX_BODY_CHARS = 200_000; // a real response is ~30-60 KB

export async function sha1Hex(text: string): Promise<string> {
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!subtle) throw new Error("no_crypto");
  const buf = await subtle.digest("SHA-1", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Parse a range response and return the breach count for `suffix` (0 if absent).
 * Throws on any malformed content so callers fail closed instead of treating
 * garbage as "not found". Padding entries (count 0) are ignored by design.
 */
export function countInRange(body: string, suffix: string): number {
  if (typeof body !== "string" || body.length === 0 || body.length > MAX_BODY_CHARS) throw new Error("malformed");
  let valid = 0, found = 0;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = LINE_RE.exec(line.toUpperCase());
    if (!m) throw new Error("malformed");
    valid++;
    if (m[1] === suffix) found = Math.max(found, parseInt(m[2], 10));
  }
  if (valid === 0) throw new Error("malformed");
  return found;
}

export async function screenPassword(
  password: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ScreenResult> {
  const fetchImpl = opts.fetchImpl ?? (typeof fetch === "function" ? fetch : undefined);
  if (!fetchImpl) return { status: "unavailable", reason: "network" };

  let hash: string;
  try { hash = await sha1Hex(password); } catch { return { status: "unavailable", reason: "no_crypto" }; }
  const prefix = hash.slice(0, 5), suffix = hash.slice(5);
  if (!PREFIX_RE.test(prefix)) return { status: "unavailable", reason: "malformed" };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 6000);
  try {
    // Only the 5-character prefix is placed in the URL. Add-Padding hides the true bucket size.
    const res = await fetchImpl(HIBP_RANGE_URL + prefix, {
      method: "GET",
      headers: { "Add-Padding": "true" },
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: ctl.signal,
    });
    if (!res.ok) return { status: "unavailable", reason: "http" };
    const body = await res.text();
    let count: number;
    try { count = countInRange(body, suffix); } catch { return { status: "unavailable", reason: "malformed" }; }
    return count > 0 ? { status: "breached", count } : { status: "safe" };
  } catch (e) {
    const aborted = ctl.signal.aborted || (e as { name?: string })?.name === "AbortError";
    return { status: "unavailable", reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** User-facing text. Contains no password or hash material. */
export function screenMessage(r: ScreenResult): string {
  if (r.status === "breached") return "This password appears in known data breaches. Choose a different, unique password.";
  if (r.status === "unavailable") return "We could not check your password against known breaches right now, so your account was not created. Please try again in a moment.";
  return "";
}
