import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_ADMIN_URL ?? "postgres://idel_admin:idel_admin_local_only@localhost:5432/idel_os",
  },
  strict: true,
  verbose: true,
});
