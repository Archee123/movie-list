import { profile, json, sameOrigin } from "@/lib/auth";
import { allTags } from "@/lib/tags";
import { updateMovie } from "@/lib/storage";
import type { Movie } from "@/lib/types";

class UnwatchedRatingError extends Error {}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const who = await profile();
  if (!who) return json({ error: "Please unlock Frame." }, 401);
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  const { id } = await params;
  if (!/^((?:tv-)?\d{1,12}|manual-[a-f0-9-]{36})$/.test(id))
    return json({ error: "Invalid movie" }, 400);
  try {
    const d = await req.json();
    let update: (movie: Movie) => Movie;
    if (d.personalRating !== undefined) {
      const rating: unknown = d.personalRating;
      if (
        rating !== null &&
        (typeof rating !== "number" ||
          !Number.isFinite(rating) ||
          rating < 0 ||
          rating > 10 ||
          !Number.isInteger(rating * 10))
      )
        return json(
          { error: "Use a score from 0 to 10 with up to one decimal place." },
          400,
        );
      update = (movie) => {
        if (!movie.watched) throw new UnwatchedRatingError();
        const personalRatings = { ...movie.personalRatings };
        if (rating === null) delete personalRatings[who];
        else personalRatings[who] = rating;
        return { ...movie, personalRatings };
      };
    } else if (d.tags !== undefined) {
      const available = new Set((await allTags()).map((t) => t.id));
      if (
        !Array.isArray(d.tags) ||
        d.tags.length > 50 ||
        !d.tags.every((t: unknown) => typeof t === "string" && available.has(t))
      )
        return json({ error: "Invalid tags" }, 400);
      const tags = [...new Set<string>(d.tags)];
      update = (movie) => ({ ...movie, tags });
    } else if (d.deleted === true) {
      update = (movie) => ({ ...movie, deleted: true });
    } else if (typeof d.watched === "boolean") {
      const watched: boolean = d.watched;
      update = (movie) => ({
        ...movie,
        watched,
        watchedBy: watched ? who : null,
        watchedAt: watched ? new Date().toISOString() : null,
      });
    } else {
      return json({ error: "Invalid update" }, 400);
    }
    const movie = await updateMovie(id, update);
    if (!movie) return json({ error: "Movie not found" }, 404);
    return json({ movie });
  } catch (error) {
    if (error instanceof UnwatchedRatingError)
      return json(
        { error: "Mark this title as watched before rating it." },
        409,
      );
    return json(
      { error: "We couldn’t save that change. Please try again." },
      503,
    );
  }
}
