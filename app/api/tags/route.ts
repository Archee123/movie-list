import { profile, json, sameOrigin } from "@/lib/auth";
import { del } from "@vercel/blob";
import { allMovies, saveMovie } from "@/lib/storage";
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

export async function DELETE(req: Request) {
  if (!(await profile())) return json({ error: "Please sign in." }, 401);
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  try {
    const d = await req.json();
    if (typeof d.id !== "string" || !/^[a-f0-9]{24}$/.test(d.id))
      return json({ error: "Invalid tag." }, 400);
    const movies = await allMovies();
    for (const movie of movies) {
      if (movie.tags?.includes(d.id))
        await saveMovie({
          ...movie,
          tags: movie.tags.filter((id) => id !== d.id),
        });
    }
    await del("frame/tags/" + d.id + ".json");
    return json({ deleted: d.id });
  } catch {
    return json({ error: "Could not delete tag. Please try again." }, 503);
  }
}
