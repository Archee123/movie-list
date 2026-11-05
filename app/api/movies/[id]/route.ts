import { profile, json, sameOrigin } from "@/lib/auth";
import { readMovie, saveMovie } from "@/lib/storage";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await profile();
  if (!who) return json({ error: "Please unlock Frame." }, 401);
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  const { id } = await params;
  if (!/^(\d{1,12}|manual-[a-f0-9-]{36})$/.test(id))
    return json({ error: "Invalid movie" }, 400);
  try {
    const movie = await readMovie(id);
    if (!movie || movie.deleted) return json({ error: "Movie not found" }, 404);
    const d = await req.json();
    if (d.deleted !== true && typeof d.watched !== "boolean")
      return json({ error: "Invalid update" }, 400);
    const updated =
      d.deleted === true
        ? { ...movie, deleted: true }
        : {
            ...movie,
            watched: d.watched,
            watchedBy: d.watched ? who : null,
            watchedAt: d.watched ? new Date().toISOString() : null,
          };
    return json({ movie: await saveMovie(updated) });
  } catch {
    return json(
      { error: "We couldn’t save that change. Please try again." },
      503,
    );
  }
}
