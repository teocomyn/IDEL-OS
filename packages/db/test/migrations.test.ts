import { readdir } from "node:fs/promises";
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
});
