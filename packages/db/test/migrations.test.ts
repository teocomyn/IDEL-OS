import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("migrations", () => {
  it("provides a reverse migration for every forward migration", async () => {
    const directory = resolve(import.meta.dirname, "../migrations");
    const files = await readdir(directory);
    const forward = files.filter((file) => /^\d{4}_.+\.sql$/.test(file) && !file.endsWith(".down.sql"));
    const reverse = new Set(files.filter((file) => file.endsWith(".down.sql")));
    for (const migration of forward) {
      expect(reverse.has(migration.replace(/\.sql$/, ".down.sql"))).toBe(true);
    }
  });

  it("registers every forward migration in the Drizzle journal", async () => {
    const directory = resolve(import.meta.dirname, "../migrations");
    const files = await readdir(directory);
    const forward = files.filter((file) => /^\d{4}_.+\.sql$/.test(file) && !file.endsWith(".down.sql"));
    const journal = JSON.parse(await readFile(resolve(directory, "meta/_journal.json"), "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    const registered = new Set(journal.entries.map(({ tag }) => `${tag}.sql`));
    for (const migration of forward) expect(registered.has(migration)).toBe(true);
  });
});
