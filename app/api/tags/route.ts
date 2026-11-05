import { profile, json, sameOrigin } from "@/lib/auth";
import { allTags, createTag } from "@/lib/tags";
export async function GET() {
  if (!(await profile())) return json({ error: "Please sign in." }, 401);
  try {
    return json({ tags: await allTags() });
  } catch {
    return json({ error: "Could not load tags." }, 503);
  }
}
export async function POST(req: Request) {
  if (!(await profile())) return json({ error: "Please sign in." }, 401);
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  try {
    const d = await req.json();
    if (
      typeof d.name !== "string" ||
      !d.name.trim() ||
      d.name.trim().length > 30
    )
      return json(
        { error: "Use a tag name between 1 and 30 characters." },
        400,
      );
    return json({ tag: await createTag(d.name.trim()) });
  } catch {
    return json({ error: "Could not create tag." }, 503);
  }
}
