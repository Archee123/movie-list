import type { SearchMovie } from "./types";
export function catalogReady() {
  return !!(process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY);
}
export async function tmdb(path: string) {
  const key = process.env.TMDB_API_KEY,
    token = process.env.TMDB_READ_TOKEN;
  if (!key && !token)
    throw new Error(
      "Movie search is not connected yet. You can still add a title manually.",
    );
  const url = new URL("https://api.themoviedb.org/3/" + path);
  if (!token && key) url.searchParams.set("api_key", key);
  const r = await fetch(url, {
    headers: token ? { Authorization: "Bearer " + token } : undefined,
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw new Error(
      "Movie search is temporarily unavailable. Please try again.",
    );
  return r.json();
}
export function mapMovie(m: Record<string, unknown>): SearchMovie {
  return {
    id: (m.media_type === "tv" ? "tv-" : "") + String(m.id),
    mediaType: m.media_type === "tv" ? "tv" : "movie",
    title: String(m.title || m.name),
    year: String(m.release_date || m.first_air_date || "").slice(0, 4),
    poster: m.poster_path
      ? "https://image.tmdb.org/t/p/w500" + m.poster_path
      : null,
    overview: String(m.overview || ""),
  };
}
export async function movieDetails(id: string) {
  const tv = id.startsWith("tv-");
  const m = await tmdb(
    (tv ? "tv/" + id.slice(3) : "movie/" + id) +
      "?append_to_response=external_ids",
  );
  m.media_type = tv ? "tv" : "movie";
  let rating: string | null = null;
  const imdbId = m.imdb_id || m.external_ids?.imdb_id || null;
  if (process.env.OMDB_API_KEY && imdbId) {
    try {
      const r = await fetch(
        "https://www.omdbapi.com/?apikey=" +
          encodeURIComponent(process.env.OMDB_API_KEY) +
          "&i=" +
          imdbId,
        { next: { revalidate: 604800 }, signal: AbortSignal.timeout(7000) },
      );
      const d = await r.json();
      if (d.Response === "True" && /^\d+(\.\d+)?$/.test(d.imdbRating))
        rating = d.imdbRating;
    } catch {
      /* A missing rating must not prevent saving a film. */
    }
  }
  return { ...mapMovie(m), rating, imdbId };
}
