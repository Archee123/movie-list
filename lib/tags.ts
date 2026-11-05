import { get, list, put } from "@vercel/blob";
import { createHash } from "node:crypto";
export type Tag = { id: string; name: string };
export async function allTags(): Promise<Tag[]> {
  const tags: Tag[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "frame/tags/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      const r = await get(b.pathname, { access: "private", useCache: false });
      if (r?.statusCode === 200)
        tags.push(JSON.parse(await new Response(r.stream).text()));
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}
export async function createTag(name: string) {
  const id = createHash("sha256")
    .update(name.normalize("NFKC").toLocaleLowerCase("en-GB"))
    .digest("hex")
    .slice(0, 24);
  const tag = { id, name };
  try {
    await put("frame/tags/" + id + ".json", JSON.stringify(tag), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
    });
    return tag;
  } catch (e) {
    const existing = (await allTags()).find((t) => t.id === id);
    if (existing) return existing;
    throw e;
  }
}
