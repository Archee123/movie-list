import { profile, json, sameOrigin } from "@/lib/auth";
import { readCollection, updateCollection } from "@/lib/storage";
import { tagId } from "@/lib/tags";
export async function GET() {
  if (!(await profile())) return json({ error: "Please sign in." }, 401);
  try {
    return json({ tags: (await readCollection()).tags });
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
    const name: string = d.name.trim();
    const id = tagId(name);
    const tag = await updateCollection(({ tags }) => {
      const existing = tags.find((item) => item.id === id);
      if (existing) return { result: existing, changed: false };
      const created = { id, name };
      tags.push(created);
      return { result: created, changed: true };
    });
    return json({ tag });
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
    const id: string = d.id;
    await updateCollection((collection) => {
      const index = collection.tags.findIndex((tag) => tag.id === id);
      if (index === -1) return { result: undefined, changed: false };
      collection.tags.splice(index, 1);
      for (const movie of collection.movies) {
        if (movie.tags?.includes(id))
          movie.tags = movie.tags.filter((tag) => tag !== id);
      }
      return { result: undefined, changed: true };
    });
    return json({ deleted: d.id });
  } catch {
    return json({ error: "Could not delete tag. Please try again." }, 503);
  }
}
