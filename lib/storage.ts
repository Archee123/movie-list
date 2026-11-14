import { BlobPreconditionFailedError, get, list, put } from "@vercel/blob";
import type { Movie, Tag } from "./types";

const path = "frame/collection.json";
const privateRead = { access: "private", useCache: false } as const;
const privateWrite = {
  access: "private",
  addRandomSuffix: false,
  contentType: "application/json",
} as const;

type Collection = { movies: Movie[]; tags: Tag[] };

async function readCollectionRecord() {
  const result = await get(path, privateRead);
  if (!result) return null;
  if (result.statusCode !== 200) throw new Error("Could not read collection");
  const collection: Collection = await new Response(result.stream).json();
  if (!Array.isArray(collection.movies) || !Array.isArray(collection.tags))
    throw new Error("Invalid collection");
  return { collection, etag: result.blob.etag };
}

async function readLegacyRecords<T>(prefix: string): Promise<T[]> {
  const records: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (let i = 0; i < page.blobs.length; i += 20) {
      const batch = await Promise.all(
        page.blobs.slice(i, i + 20).map(async ({ pathname }) => {
          const result = await get(pathname, privateRead);
          if (result?.statusCode !== 200)
            throw new Error("Could not read legacy record " + pathname);
          return (await new Response(result.stream).json()) as T;
        }),
      );
      records.push(...batch);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return records;
}

async function migrateCollection() {
  const [movies, tags] = await Promise.all([
    readLegacyRecords<Movie>("frame/movies/"),
    readLegacyRecords<Tag>("frame/tags/"),
  ]);
  const collection = { movies, tags };
  try {
    const saved = await put(path, JSON.stringify(collection), {
      ...privateWrite,
      allowOverwrite: false,
    });
    return { collection, etag: saved.etag };
  } catch (error) {
    // Another instance may have initialized the collection first.
    const existing = await readCollectionRecord();
    if (existing) return existing;
    throw error;
  }
}

let migration: ReturnType<typeof migrateCollection> | undefined;

async function loadCollection() {
  const existing = await readCollectionRecord();
  if (existing) return existing;
  migration ??= migrateCollection().finally(() => {
    migration = undefined;
  });
  return migration;
}

export async function readCollection() {
  const { collection } = await loadCollection();
  return {
    movies: collection.movies
      .filter((movie) => !movie.deleted)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    tags: [...collection.tags].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function updateCollection<T>(
  update: (collection: Collection) => { result: T; changed: boolean },
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const { collection, etag } = await loadCollection();
    const { result, changed } = update(collection);
    if (!changed) return result;
    try {
      await put(path, JSON.stringify(collection), {
        ...privateWrite,
        allowOverwrite: true,
        ifMatch: etag,
      });
      return result;
    } catch (error) {
      if (!(error instanceof BlobPreconditionFailedError) || attempt >= 3)
        throw error;
    }
  }
}
