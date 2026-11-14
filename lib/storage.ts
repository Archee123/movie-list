import { BlobPreconditionFailedError, get, list, put } from "@vercel/blob";
import type { Movie } from "./types";
const prefix = "frame/movies/";
async function readMovieRecord(id: string) {
  const r = await get(prefix + id + ".json", {
    access: "private",
    useCache: false,
  });
  if (!r || r.statusCode !== 200) return null;
  const movie: Movie = await new Response(r.stream).json();
  return { movie, etag: r.blob.etag };
}
export async function readMovie(id: string): Promise<Movie | null> {
  return (await readMovieRecord(id))?.movie ?? null;
}
export async function saveMovie(movie: Movie, ifMatch?: string) {
  await put(prefix + movie.id + ".json", JSON.stringify(movie), {
    access: "private",
    allowOverwrite: true,
    ifMatch,
    addRandomSuffix: false,
    contentType: "application/json",
  });
  return movie;
}
export async function updateMovie(
  id: string,
  update: (movie: Movie) => Movie,
): Promise<Movie | null> {
  for (let attempt = 0; ; attempt++) {
    const record = await readMovieRecord(id);
    if (!record || record.movie.deleted) return null;
    const updated = update(record.movie);
    if (updated === record.movie) return updated;
    try {
      return await saveMovie(updated, record.etag);
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt >= 2)
        throw error;
    }
  }
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
