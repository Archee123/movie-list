import { randomUUID } from "node:crypto";
import { profile, json, sameOrigin } from "@/lib/auth";
import { allMovies, readMovie, saveMovie } from "@/lib/storage";
import { catalogReady, movieDetails } from "@/lib/catalog";
export async function GET() {
  if (!(await profile())) return json({ error: "Please unlock Frame." }, 401);
  try {
    return json({
      movies: await allMovies(),
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
    if (typeof d.tmdbId === "string" && /^\d{1,12}$/.test(d.tmdbId)) {
      film = await movieDetails(d.tmdbId);
      const existing = await readMovie(film.id);
      if (existing && !existing.deleted)
        return json({ movie: existing, alreadyAdded: true });
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
      const existing = (await allMovies()).find(
        (m) =>
          m.title.toLowerCase() === d.title.trim().toLowerCase() &&
          m.year === (d.year || ""),
      );
      if (existing) return json({ movie: existing, alreadyAdded: true });
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
    const movie = await saveMovie({
      ...film,
      addedBy: who,
      addedAt: new Date().toISOString(),
      watched: false,
      watchedBy: null,
      watchedAt: null,
    });
    return json({ movie });
  } catch {
    return json({ error: "We couldn’t add that film. Please try again." }, 503);
  }
}
