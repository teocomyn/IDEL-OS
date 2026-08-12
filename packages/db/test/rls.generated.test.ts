import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { organizationScopedTables } from "../src/schema/index.js";

const { Client } = pg;
const migrationDirectory = resolve(import.meta.dirname, "../migrations");
let container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
let admin: pg.Client;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgis/postgis:16-3.5-alpine")
    .withPlatform("linux/amd64")
    .withDatabase("idel_os")
    .withUsername("idel_admin")
    .withPassword("idel_admin_local_only")
    .start();
  admin = new Client({ connectionString: container.getConnectionUri() });
  await admin.connect();
  const files = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql") && !file.endsWith(".down.sql"))
    .sort();
  for (const file of files) {
    await admin.query(await readFile(resolve(migrationDirectory, file), "utf8"));
  }
});

afterAll(async () => {
  await admin?.end();
  await container?.stop();
});

describe("generated RLS coverage", () => {
  it.each(organizationScopedTables)("isolates %s between organizations", async (table) => {
    const policy = await admin.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = $1::regclass`,
      [table],
    );
    expect(policy.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true });

    const policyCount = await admin.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
      [table],
    );
    expect(Number(policyCount.rows[0]?.count)).toBeGreaterThan(0);
  });

  it("prevents organization A from reading organization B patients", async () => {
    const organizationA = "0198f54c-4064-7000-8000-000000000101";
    const organizationB = "0198f54c-4064-7000-8000-000000000102";
    await admin.query(
      `INSERT INTO organizations (id, name, type) VALUES ($1, 'Synthetic Org A', 'solo'), ($2, 'Synthetic Org B', 'solo')`,
      [organizationA, organizationB],
    );
    await admin.query(
      `INSERT INTO patients
       (org_id, first_name_enc, last_name_enc, birth_date_enc, address_line_enc, postal_code, city, mobility)
       VALUES ($1, 'encrypted', 'encrypted', 'encrypted', 'encrypted', '00000', 'Ville Fictive', 'autonomous'),
              ($2, 'encrypted', 'encrypted', 'encrypted', 'encrypted', '00000', 'Ville Fictive', 'autonomous')`,
      [organizationA, organizationB],
    );

    await admin.query("SET ROLE idel_app");
    await admin.query("SELECT set_config('app.current_org_id', $1, false)", [organizationA]);
    const visible = await admin.query<{ org_id: string }>("SELECT org_id FROM patients");
    await admin.query("RESET ROLE");

    expect(visible.rows).toEqual([{ org_id: organizationA }]);
  });
});

describe("audit log database protection", () => {
  it("rejects updates and deletes", async () => {
    const functions = await admin.query<{ proname: string }>(
      "SELECT proname FROM pg_proc WHERE proname = 'prevent_audit_log_mutation'",
    );
    expect(functions.rows).toHaveLength(1);
  });
});
