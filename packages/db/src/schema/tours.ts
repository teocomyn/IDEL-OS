import { boolean, date, integer, jsonb, pgTable, point, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { organizations, users } from "./core.js";
import { tourStatusEnum } from "./enums.js";

export const tours = pgTable("tours", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  status: tourStatusEnum("status").default("draft").notNull(),
  startLocation: point("start_location", { mode: "xy" }),
  endLocation: point("end_location", { mode: "xy" }),
  plannedDistanceM: integer("planned_distance_m"),
  plannedDurationS: integer("planned_duration_s"),
  actualDistanceM: integer("actual_distance_m"),
  actualDurationS: integer("actual_duration_s"),
  optimizationRunId: uuid("optimization_run_id"),
});

export const optimizationRuns = pgTable("optimization_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tourId: uuid("tour_id").notNull().references(() => tours.id, { onDelete: "cascade" }),
  algorithm: text("algorithm").notNull(),
  paramsJson: jsonb("params_json").notNull(),
  beforeMetrics: jsonb("before_metrics").notNull(),
  afterMetrics: jsonb("after_metrics").notNull(),
  accepted: boolean("accepted").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
