import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { profile, json, sameOrigin } from "@/lib/auth";
import { equal, isProfile, signSession } from "@/lib/session";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET() {
  return json({ profile: await profile() });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  if (!process.env.SITE_PASSCODE || !process.env.SESSION_SECRET)
    return json({ error: "Site access is not configured." }, 503);
  const ip = createHash("sha256")
    .update(req.headers.get("x-forwarded-for") || "local")
    .digest("hex");
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until < now) attempts.delete(key);
  const attempt = attempts.get(ip);
  if (attempt && attempt.count >= 10)
    return json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      429,
    );
  let data;
  try {
    data = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!isProfile(data.profile))
    return json({ error: "Choose Archie or Susu." }, 400);
  if (
    typeof data.passcode !== "string" ||
    !equal(data.passcode, process.env.SITE_PASSCODE)
  ) {
    attempts.set(ip, {
      count: (attempt?.count || 0) + 1,
      until: attempt?.until || now + 900000,
    });
    return json({ error: "That passcode isn’t right. Try again." }, 401);
  }
  attempts.delete(ip);
  (await cookies()).set("frame_session", signSession(data.profile), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 86400,
  });
  return json({ profile: data.profile });
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  (await cookies()).delete("frame_session");
  return json({ ok: true });
}
