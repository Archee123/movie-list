import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
test(
  "private shared list, catalog, profile attribution and watched round trip",
  { skip: !base },
  async () => {
    const call = async (
      path,
      { method = "GET", cookie, body, origin = base } = {},
    ) =>
      fetch(base + "/api/" + path, {
        method,
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body
            ? { "Content-Type": "application/json", Origin: origin }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    assert.equal((await call("movies")).status, 401);
    assert.equal((await call("search?q=Interstellar")).status, 401);
    assert.equal(
      (
        await call("session", {
          method: "POST",
          body: { profile: "Archie", passcode: "wrong" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await call("session", {
          method: "POST",
          origin: "https://untrusted.example",
          body: { profile: "Archie", passcode: process.env.SITE_PASSCODE },
        })
      ).status,
      403,
    );
    const login = async (profile) => {
      const r = await call("session", {
        method: "POST",
        body: { profile, passcode: process.env.SITE_PASSCODE },
      });
      assert.equal(r.status, 200);
      return r.headers.get("set-cookie").split(";")[0];
    };
    const archie = await login("Archie"),
      susu = await login("Susu");
    const search = await call("search?q=Interstellar", { cookie: archie });
    assert.equal(search.status, 200);
    const results = (await search.json()).results;
    assert.ok(
      results.some(
        (m) =>
          m.title === "Interstellar" &&
          m.year === "2014" &&
          m.poster.startsWith("https://image.tmdb.org/"),
      ),
    );
    let id;
    try {
      const added = await call("movies", {
        method: "POST",
        cookie: archie,
        body: { title: "Frame integration test " + Date.now(), year: "2026" },
      });
      assert.equal(added.status, 200);
      const movie = (await added.json()).movie;
      id = movie.id;
      assert.equal(movie.addedBy, "Archie");
      const list = await call("movies", { cookie: susu });
      assert.ok((await list.json()).movies.some((m) => m.id === id));
      const watched = await call("movies/" + id, {
        method: "PATCH",
        cookie: susu,
        body: { watched: true },
      });
      assert.equal(watched.status, 200);
      const w = (await watched.json()).movie;
      assert.equal(w.watched, true);
      assert.equal(w.watchedBy, "Susu");
      const persisted = await call("movies", { cookie: archie });
      assert.equal(
        (await persisted.json()).movies.find((m) => m.id === id).watched,
        true,
      );
      const undo = await call("movies/" + id, {
        method: "PATCH",
        cookie: archie,
        body: { watched: false },
      });
      assert.equal((await undo.json()).movie.watched, false);
    } finally {
      if (id)
        assert.equal(
          (
            await call("movies/" + id, {
              method: "PATCH",
              cookie: archie,
              body: { deleted: true },
            })
          ).status,
          200,
        );
    }
  },
);
