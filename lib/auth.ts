import { cookies } from "next/headers";
import { verifySession } from "./session";
export async function profile() {
  return verifySession((await cookies()).get("frame_session")?.value);
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return (
      new URL(origin).host ===
      (req.headers.get("host") || new URL(req.url).host)
    );
  } catch {
    return false;
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
