import { randomUUID } from "node:crypto";
import { profile, json, sameOrigin } from "@/lib/auth";
import { readCollection, updateCollection } from "@/lib/storage";
import type { Movie } from "@/lib/types";
import { catalogReady, movieDetails } from "@/lib/catalog";
export async function GET() {
  if (!(await profile())) return json({ error: "Please unlock Frame." }, 401);
  try {
    return json({
      ...(await readCollection()),
      catalogReady: catalogReady(),
      ratingsReady: !!process.env.OMDB_API_KEY,
    });
  } catch {
    return json(
      { error: "We couldn’t load your shared list. Please try again." },
      503,
    );
  }
}
export async function POST(req: Request) {
  const who = await profile();
  if (!who) return json({ error: "Please unlock Frame." }, 401);
  if (!sameOrigin(req)) return json({ error: "Invalid request" }, 403);
  try {
    const d = await req.json();
    let film;
    let manual = false;
    if (typeof d.tmdbId === "string" && /^(tv-)?\d{1,12}$/.test(d.tmdbId)) {
      film = await movieDetails(d.tmdbId);
    } else {
      if (
        typeof d.title !== "string" ||
        !d.title.trim() ||
        d.title.trim().length > 150
      )
        return json(
          { error: "Enter a movie title (up to 150 characters)." },
          400,
        );
      if (d.year && !/^\d{4}$/.test(d.year))
        return json({ error: "Enter a four-digit year." }, 400);
      manual = true;
      film = {
        id: "manual-" + randomUUID(),
        title: d.title.trim(),
        year: d.year || "",
        poster: null,
        rating: null,
        imdbId: null,
        overview: "",
      };
    }
    const movie: Movie = {
      ...film,
      addedBy: who,
      addedAt: new Date().toISOString(),
      tags: [],
      watched: false,
      watchedBy: null,
      watchedAt: null,
    };
    const result = await updateCollection(({ movies }) => {
      const existing = movies.find(
        (item) =>
          !item.deleted &&
          (manual
            ? item.title.toLowerCase() === movie.title.toLowerCase() &&
              item.year === movie.year
            : item.id === movie.id),
      );
      if (existing)
        return {
          result: { movie: existing, alreadyAdded: true },
          changed: false,
        };
      const index = movies.findIndex((item) => item.id === movie.id);
      if (index === -1) movies.push(movie);
      else movies[index] = movie;
      return { result: { movie, alreadyAdded: false }, changed: true };
    });
    return json(result);
  } catch {
    return json({ error: "We couldn’t add that film. Please try again." }, 503);
  }
}
