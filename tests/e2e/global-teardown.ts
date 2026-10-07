import fs from "node:fs";
import { loadTestEnv } from "./support/env";
import { DIR, MANIFEST, readManifest } from "./support/manifest";
import { teardown } from "./support/seed";

/** Deletes everything the tests made, so the database is left as it was found. */
export default async function globalTeardown() {
  loadTestEnv();
  if (!fs.existsSync(MANIFEST)) return;
  await teardown(readManifest());
  fs.rmSync(DIR, { recursive: true, force: true });
}
