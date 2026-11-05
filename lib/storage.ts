import { get, list, put } from "@vercel/blob";
import type { Movie } from "./types";
const prefix = "frame/movies/";
export async function readMovie(id: string): Promise<Movie | null> {
  const r = await get(prefix + id + ".json", {
    access: "private",
    useCache: false,
  });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}
export async function saveMovie(movie: Movie) {
  await put(prefix + movie.id + ".json", JSON.stringify(movie), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return movie;
}
export async function allMovies() {
  let cursor: string | undefined;
  const ids: string[] = [];
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    ids.push(...page.blobs.map((b) => b.pathname.slice(prefix.length, -5)));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const movies: Movie[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = await Promise.all(ids.slice(i, i + 20).map(readMovie));
    movies.push(...chunk.filter((m): m is Movie => !!m && !m.deleted));
  }
  return movies.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}
