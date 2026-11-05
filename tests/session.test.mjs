import { test } from "node:test";
import assert from "node:assert/strict";
import { signSession, verifySession } from "../lib/session.ts";
process.env.SESSION_SECRET ||=
  "test-only-secret-that-is-at-least-32-characters";
test("signed sessions identify both profiles and expire", () => {
  for (const p of ["Archie", "Susu"]) {
    const token = signSession(p, 1000);
    assert.equal(verifySession(token, 1001), p);
    assert.equal(verifySession(token, 1000 + 30 * 86400000), null);
  }
});
test("tampered, malformed and missing sessions are rejected", () => {
  const token = signSession("Archie");
  assert.equal(verifySession(undefined), null);
  assert.equal(verifySession("bad"), null);
  assert.equal(verifySession(token + "x"), null);
  assert.equal(verifySession(token + ".extra"), null);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(body, "base64url").toString()),
      profile: "Susu",
    }),
  ).toString("base64url");
  assert.equal(verifySession(forged + "." + sig), null);
});
