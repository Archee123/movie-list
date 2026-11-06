import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function route({ signedIn = true, sameOrigin = true, failSave = false } = {}) {
  const movies = [
    { id: "1", tags: ["a".repeat(24), "b".repeat(24)] },
    { id: "2", tags: ["b".repeat(24)] },
  ];
  const saved = [],
    deleted = [];
  const deps = {
    "@/lib/auth": {
      profile: async () => signedIn,
      sameOrigin: () => sameOrigin,
      json: (data, status = 200) => Response.json(data, { status }),
    },
    "@/lib/tags": {},
    "@/lib/storage": {
      allMovies: async () => movies,
      saveMovie: async (m) => {
        if (failSave) throw new Error("storage unavailable");
        saved.push(m);
      },
    },
    "@vercel/blob": { del: async (path) => deleted.push(path) },
  };
  const source = ts.transpileModule(
    readFileSync(new URL("../app/api/tags/route.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const exports = {};
  new Function("require", "exports", source)((name) => deps[name], exports);
  return { ...exports, saved, deleted };
}
const request = (id) =>
  new Request("https://example.com/api/tags", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
test("deleting a tag removes only its assignments before deleting the definition", async () => {
  const r = route();
  assert.equal((await r.DELETE(request("a".repeat(24)))).status, 200);
  assert.deepEqual(r.saved, [{ id: "1", tags: ["b".repeat(24)] }]);
  assert.deepEqual(r.deleted, ["frame/tags/" + "a".repeat(24) + ".json"]);
});
test("tag deletion rejects unauthenticated, cross-origin and invalid requests", async () => {
  for (const [options, id, status] of [
    [{ signedIn: false }, "a".repeat(24), 401],
    [{ sameOrigin: false }, "a".repeat(24), 403],
    [{}, "../movies/1", 400],
  ]) {
    const r = route(options);
    assert.equal((await r.DELETE(request(id))).status, status);
    assert.deepEqual(r.saved, []);
    assert.deepEqual(r.deleted, []);
  }
});
test("failed assignment cleanup keeps the tag definition so deletion can be retried", async () => {
  const r = route({ failSave: true });
  assert.equal((await r.DELETE(request("a".repeat(24)))).status, 503);
  assert.deepEqual(r.deleted, []);
});
