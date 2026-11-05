import { createHmac, timingSafeEqual } from "node:crypto";
import type { Profile } from "./types";
export const isProfile = (v: unknown): v is Profile =>
  v === "Archie" || v === "Susu";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("Session secret not configured");
  return s;
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function signSession(profile: Profile, now = Date.now()) {
  const body = Buffer.from(
    JSON.stringify({ profile, expires: now + 30 * 86400000 }),
  ).toString("base64url");
  return (
    body + "." + createHmac("sha256", secret()).update(body).digest("base64url")
  );
}
export function verifySession(
  token: string | undefined,
  now = Date.now(),
): Profile | null {
  try {
    if (!token) return null;
    const [body, sig, ...extra] = token.split(".");
    if (
      extra.length ||
      !body ||
      !sig ||
      !equal(
        sig,
        createHmac("sha256", secret()).update(body).digest("base64url"),
      )
    )
      return null;
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    return isProfile(data.profile) &&
      Number.isFinite(data.expires) &&
      data.expires > now
      ? data.profile
      : null;
  } catch {
    return null;
  }
}
