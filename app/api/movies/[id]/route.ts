import { profile, json, sameOrigin } from "@/lib/auth";
import { updateCollection } from "@/lib/storage";
import type { Movie, Tag } from "@/lib/types";

class UnwatchedRatingError extends Error {}
class InvalidTagsError extends Error {}
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
    let update: (movie: Movie, tags: Tag[]) => Movie;
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
      if (
        !Array.isArray(d.tags) ||
        d.tags.length > 50 ||
        !d.tags.every((t: unknown) => typeof t === "string")
      )
        return json({ error: "Invalid tags" }, 400);
      const tags = [...new Set<string>(d.tags)];
      update = (movie, available) => {
        if (!tags.every((id) => available.some((tag) => tag.id === id)))
          throw new InvalidTagsError();
        return { ...movie, tags };
      };
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
    const movie = await updateCollection<Movie | null>(({ movies, tags }) => {
      const index = movies.findIndex((item) => item.id === id && !item.deleted);
      if (index === -1) return { result: null, changed: false };
      const updated = update(movies[index], tags);
      movies[index] = updated;
      return { result: updated, changed: true };
    });
    if (!movie) return json({ error: "Movie not found" }, 404);
    return json({ movie });
  } catch (error) {
    if (error instanceof InvalidTagsError)
      return json({ error: "Invalid tags" }, 400);
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
