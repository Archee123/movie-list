import { NeonDbError, neon } from "@neondatabase/serverless";
import { get, list } from "@vercel/blob";
import type { Movie, Tag } from "./types";

const path = "frame/collection.json";
const privateRead = { access: "private", useCache: false } as const;

type Collection = { movies: Movie[]; tags: Tag[] };

let client: ReturnType<typeof neon<false, false>> | undefined;

function database() {
  if (client) return client;
  const url = process.env.PALACE_NEON_DATABASE_URL;
  if (!url) throw new Error("PALACE_NEON_DATABASE_URL is required");
  client = neon(url);
  return client;
}

function parseCollection(data: unknown): Collection {
  if (
    !data ||
    typeof data !== "object" ||
    !("movies" in data) ||
    !("tags" in data) ||
    !Array.isArray(data.movies) ||
    !Array.isArray(data.tags)
  )
    throw new Error("Invalid collection");
  return { movies: data.movies, tags: data.tags };
}

async function readCollectionRecord() {
  const sql = database();
  try {
    const [row] = await sql`
      SELECT collection, revision FROM palace_collection WHERE id = 1
    `;
    return row
      ? {
          collection: parseCollection(row.collection),
          revision: Number(row.revision),
        }
      : null;
  } catch (error) {
    if (error instanceof NeonDbError && error.code === "42P01") return null;
    throw error;
  }
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

async function readBlobCollection(): Promise<Collection> {
  if (
    !process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.VERCEL_ENV !== "production"
  )
    return { movies: [], tags: [] };

  const source = await get(path, privateRead);
  if (source) {
    if (source.statusCode !== 200) throw new Error("Could not read collection");
    return parseCollection(await new Response(source.stream).json());
  }

  const [movies, tags] = await Promise.all([
    readLegacyRecords<Movie>("frame/movies/"),
    readLegacyRecords<Tag>("frame/tags/"),
  ]);
  if (movies.length === 0 && tags.length === 0)
    throw new Error("The existing collection could not be found in Blob");
  return { movies, tags };
}

async function migrateCollection() {
  const collection = await readBlobCollection();
  const sql = database();
  await sql.transaction([
    // Serialize schema creation if two requests reach a fresh database together.
    sql`SELECT pg_advisory_xact_lock(16831017)`,
    sql`
      CREATE TABLE IF NOT EXISTS palace_collection (
        id smallint PRIMARY KEY CHECK (id = 1),
        collection jsonb NOT NULL,
        revision integer NOT NULL DEFAULT 1
      )
    `,
    sql`
      INSERT INTO palace_collection (id, collection)
      VALUES (1, ${JSON.stringify(collection)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `,
  ]);
  const record = await readCollectionRecord();
  if (!record) throw new Error("Could not verify the imported collection");
  return record;
}

let migration: ReturnType<typeof migrateCollection> | undefined;

async function loadCollection() {
  const existing = await readCollectionRecord();
  if (existing) return existing;
  migration ??= migrateCollection().finally(() => {
    migration = undefined;
  });
  const imported = await migration;
  // Each concurrent request must edit its own copy after a shared import.
  return { ...imported, collection: structuredClone(imported.collection) };
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
  const sql = database();
  for (let attempt = 0; attempt < 4; attempt++) {
    const { collection, revision } = await loadCollection();
    const { result, changed } = update(collection);
    if (!changed) return result;
    const [saved] = await sql`
      UPDATE palace_collection
      SET collection = ${JSON.stringify(collection)}::jsonb, revision = revision + 1
      WHERE id = 1 AND revision = ${revision}
      RETURNING revision
    `;
    if (saved) return result;
  }
  throw new Error("The collection changed while saving. Try again.");
}
