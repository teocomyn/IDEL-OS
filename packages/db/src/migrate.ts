import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "./client.js";

const connectionString = process.env.DATABASE_ADMIN_URL;
if (connectionString === undefined) {
  throw new Error("DATABASE_ADMIN_URL is required to run migrations.");
}

const { db, pool } = createDatabase(connectionString);
await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
await pool.end();
