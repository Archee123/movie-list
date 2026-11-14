import { createHash } from "node:crypto";

export function tagId(name: string) {
  return createHash("sha256")
    .update(name.normalize("NFKC").toLocaleLowerCase("en-GB"))
    .digest("hex")
    .slice(0, 24);
}
