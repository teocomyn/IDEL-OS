import { sql } from "drizzle-orm";

import type { Database } from "./client.js";

export async function withOrganization<T>(
  database: Database,
  organizationId: string,
  operation: (transaction: Parameters<Parameters<Database["transaction"]>[0]>[0]) => Promise<T>,
): Promise<T> {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_org_id', ${organizationId}, true)`);
    return operation(transaction);
  });
}
