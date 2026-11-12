# Breached-password screening (free compensating control)

Supabase's native Leaked Password Protection is a Pro-plan feature. This project is on Free, so signup uses an
application-level preflight against the Have I Been Pwned (HIBP) Pwned Passwords range API.

**This is NOT equivalent to Supabase's server-enforced protection.**

## How it works (`src/lib/password-security.ts`)
1. On signup submit only (not per keystroke), the browser hashes the password with SHA-1 via Web Crypto.
2. Only the first 5 hex characters of the hash are sent: `GET https://api.pwnedpasswords.com/range/{prefix}`.
3. The `Add-Padding: true` header hides the true bucket size. Padding entries have count 0 and never cause a rejection.
4. The returned suffixes are compared locally. The plaintext password and full hash never leave the device.
5. Requests use `credentials: "omit"`, `referrerPolicy: "no-referrer"`, `cache: "no-store"`, a 6 s timeout.
6. Nothing is logged, stored, or sent to analytics. User-facing messages contain no password or hash material.

## Signup behavior
- Breached password: signup is stopped and a clear message is shown. `supabase.auth.signUp` is not called.
- Screening unavailable (network error, timeout, non-200, malformed body, no Web Crypto): **fail closed**; signup is not
  attempted and the user is asked to retry.
- Safe: the existing Supabase signup, email confirmation, sessions and profile creation proceed unchanged.
- Sign-in never calls HIBP.

## CORS / browser compatibility
HIBP documents that its unauthenticated APIs accept all origins, so no server-side proxy is used. The sandbox used for
development could not reach api.pwnedpasswords.com (egress blocked), so **live CORS from a real browser was not
observed here**. Verify once on the preview: attempt a signup with the password `password` (must be rejected) and watch the
Network tab for a single request to `/range/5BAA6` with no other password data. If CORS fails, signup fails closed with
the "try again" message; a prefix-only server proxy would then be needed (it must not log request paths or bodies).
Requires `crypto.subtle` (secure context: HTTPS or localhost) and `fetch`/`AbortController` (all current browsers).

## Residual limitations
- **Bypassable:** anyone can call Supabase Auth's signup endpoint directly with the public anon key and skip this check.
  Stronger enforcement needs a separately designed server-enforced signup flow (for example, a server route that
  screens and then creates the user, with direct client signups disabled) or Supabase Pro's native protection.
- Existing passwords are not rechecked. Password changes/resets are not screened by this change.
- Depends on a third-party service's availability; outages block new registrations by design.
- A breached-password check does not measure strength; the 8-character minimum is unchanged.
