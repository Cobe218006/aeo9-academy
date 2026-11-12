import assert from "node:assert/strict";
import { sha1Hex, countInRange, screenPassword, screenMessage, HIBP_RANGE_URL } from "../src/lib/password-security.ts";

const PW = "password";                                        // SHA-1 = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
const PREFIX = "5BAA6", SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";
const RAND = "z9!Qv#7Lm2$Xr8@Tn4^Wk6&";                       // not in the fake dataset
const pad = (n: number) => Array.from({ length: n }, (_, i) => (i.toString(16).toUpperCase().padStart(35, "0")) + ":0").join("\n");
const ok = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, ...init });
type Call = { url: string; init?: RequestInit };
function mock(handler: (url: string) => Promise<Response> | Response) {
  const calls: Call[] = [];
  const f = (async (url: string, init?: RequestInit) => { calls.push({ url: String(url), init }); return handler(String(url)); }) as unknown as typeof fetch;
  return { f, calls };
}
const run = async (name: string, fn: () => Promise<void>) => { await fn(); console.log("ok -", name); };

await run("SHA-1 known vector", async () => {
  assert.equal(await sha1Hex(PW), PREFIX + SUFFIX);
  assert.equal(await sha1Hex(""), "DA39A3EE5E6B4B0D3255BFEF95601890AFD80709");
});

await run("known breached password is rejected; only the 5-char prefix is sent", async () => {
  const { f, calls } = mock(() => ok(`0000000000000000000000000000000000A:2\n${SUFFIX}:10437277\n${pad(5)}`));
  const r = await screenPassword(PW, { fetchImpl: f });
  assert.deepEqual(r, { status: "breached", count: 10437277 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, HIBP_RANGE_URL + PREFIX);
  const all = JSON.stringify(calls.map((c) => ({ path: c.url.replace(HIBP_RANGE_URL, ""), init: c.init })));
  assert.ok(!all.includes(SUFFIX) && !all.toLowerCase().includes(SUFFIX.toLowerCase()), "full hash must not be sent");
  assert.ok(!all.includes(PW), "plaintext must not be sent");
  assert.equal((calls[0].init?.headers as Record<string, string>)["Add-Padding"], "true");
  assert.equal(calls[0].init?.credentials, "omit");
  assert.equal(calls[0].init?.referrerPolicy, "no-referrer");
  assert.equal(calls[0].init?.method, "GET");
});

await run("lowercase suffixes in the response still match", async () => {
  const { f } = mock(() => ok(`${SUFFIX.toLowerCase()}:5`));
  assert.equal((await screenPassword(PW, { fetchImpl: f })).status, "breached");
});

await run("password not in the dataset passes", async () => {
  const { f } = mock(() => ok(`0000000000000000000000000000000000A:2\n${pad(3)}`));
  assert.deepEqual(await screenPassword(RAND, { fetchImpl: f }), { status: "safe" });
});

await run("padding entries (count 0) never cause a rejection", async () => {
  const { f } = mock(() => ok(`${SUFFIX}:0\n${pad(2)}`));
  assert.deepEqual(await screenPassword(PW, { fetchImpl: f }), { status: "safe" });
});

for (const [name, body] of [["HTML page", "<html>blocked</html>"], ["JSON", '{"error":"x"}'], ["empty body", ""], ["short suffix", "ABC:5"], ["non-numeric count", `${SUFFIX}:many`], ["valid line then garbage", `${pad(1)}\nnot a line`]] as const) {
  await run("malformed response fails closed: " + name, async () => {
    const { f } = mock(() => ok(body));
    const r = await screenPassword(PW, { fetchImpl: f });
    assert.deepEqual(r, { status: "unavailable", reason: "malformed" });
  });
}
await run("oversized response fails closed", async () => {
  assert.throws(() => countInRange("A".repeat(200_001), SUFFIX));
});

await run("HTTP errors fail closed", async () => {
  for (const status of [403, 429, 500, 503]) {
    const { f } = mock(() => new Response("x", { status }));
    assert.deepEqual(await screenPassword(PW, { fetchImpl: f }), { status: "unavailable", reason: "http" });
  }
});

await run("network failure fails closed", async () => {
  const { f } = mock(() => { throw new TypeError("Failed to fetch"); });
  assert.deepEqual(await screenPassword(PW, { fetchImpl: f }), { status: "unavailable", reason: "network" });
});

await run("timeout fails closed", async () => {
  const f = ((_u: string, init?: RequestInit) => new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch;
  assert.deepEqual(await screenPassword(PW, { fetchImpl: f, timeoutMs: 30 }), { status: "unavailable", reason: "timeout" });
});

await run("missing Web Crypto fails closed", async () => {
  const d = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
  try {
    const { f, calls } = mock(() => ok(pad(1)));
    assert.deepEqual(await screenPassword(PW, { fetchImpl: f }), { status: "unavailable", reason: "no_crypto" });
    assert.equal(calls.length, 0, "no request when hashing is impossible");
  } finally { if (d) Object.defineProperty(globalThis, "crypto", d); }
});

await run("messages never contain password or hash material", async () => {
  for (const r of [{ status: "breached", count: 1 }, { status: "unavailable", reason: "network" }] as const) {
    const m = screenMessage(r); assert.ok(m.length > 20); assert.ok(!m.includes(RAND) && !m.includes(SUFFIX) && !m.includes(PREFIX));
  }
  assert.equal(screenMessage({ status: "safe" }), "");
});
console.log("password-security tests passed");
