import { test } from "node:test";
import assert from "node:assert/strict";
import { del } from "@vercel/blob";
const base = process.env.TEST_BASE_URL;
test(
  "shared custom tags, multiple assignments, validation and series",
  { skip: !base },
  async () => {
    const login = await fetch(base + "/api/session", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: "Archie",
        passcode: process.env.SITE_PASSCODE,
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const call = async (path, method = "GET", body) => {
      const r = await fetch(base + "/api/" + path, {
        method,
        headers: {
          Cookie: cookie,
          Origin: base,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    };
    const ids = [];
    let movie, series;
    try {
      for (const suffix of ["a", "b"]) {
        const name = "Test " + Date.now() + suffix;
        const t = await call("tags", "POST", { name });
        assert.equal(t.status, 200);
        ids.push(t.data.tag.id);
        const duplicate = await call("tags", "POST", {
          name: name.toUpperCase(),
        });
        assert.equal(duplicate.data.tag.id, t.data.tag.id);
      }
      assert.equal((await call("tags", "POST", { name: " " })).status, 400);
      movie = (
        await call("movies", "POST", { title: "Tag test " + Date.now() })
      ).data.movie;
      const tagged = await call("movies/" + movie.id, "PATCH", { tags: ids });
      assert.deepEqual(tagged.data.movie.tags, ids);
      assert.equal(
        (await call("movies/" + movie.id, "PATCH", { tags: ["invalid"] }))
          .status,
        400,
      );
      const watched = await call("movies/" + movie.id, "PATCH", {
        watched: true,
      });
      assert.deepEqual(watched.data.movie.tags, ids);
      const saved = (await call("movies")).data.movies.find(
        (m) => m.id === movie.id,
      );
      assert.deepEqual(saved.tags, ids);
      assert.equal(
        (await call("tags", "DELETE", { id: "invalid" })).status,
        400,
      );
      assert.equal((await call("tags", "DELETE", { id: ids[0] })).status, 200);
      assert.ok(!(await call("tags")).data.tags.some((t) => t.id === ids[0]));
      const afterDelete = (await call("movies")).data.movies.find(
        (m) => m.id === movie.id,
      );
      assert.deepEqual(afterDelete.tags, [ids[1]]);
      assert.equal(
        (await call("movies/" + movie.id, "PATCH", { tags: [ids[0]] })).status,
        400,
      );
      const results = (await call("search?q=Breaking%20Bad")).data.results;
      assert.ok(
        results.some((m) => m.id === "tv-1396" && m.mediaType === "tv"),
      );
      const added = await call("movies", "POST", { tmdbId: "tv-1396" });
      assert.equal(added.status, 200);
      assert.equal(added.data.movie.mediaType, "tv");
      assert.equal(added.data.movie.title, "Breaking Bad");
      assert.ok(added.data.movie.rating);
      if (!added.data.alreadyAdded) series = added.data.movie;
    } finally {
      for (const m of [movie, series])
        if (m) await call("movies/" + m.id, "PATCH", { deleted: true });
      for (const id of ids) await del("frame/tags/" + id + ".json");
    }
  },
);
