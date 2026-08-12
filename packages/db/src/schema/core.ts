import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { organizationTypeEnum, userRoleEnum } from "./enums.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: organizationTypeEnum("type").notNull(),
  siret: text("siret"),
  address: text("address"),
  settingsJson: jsonb("settings_json").notNull().default({}),
  ...timestamps,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("idel"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    rpps: text("rpps"),
    adeli: text("adeli"),
    phone: text("phone"),
    isActive: boolean("is_active").default(true).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email), index("users_org_idx").on(table.orgId)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).defaultNow().notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("memberships_org_user_unique").on(table.orgId, table.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id),
    actorUserId: uuid("actor_user_id").notNull(),
    actorRole: userRoleEnum("actor_role").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    beforeHash: text("before_hash").notNull(),
    afterHash: text("after_hash").notNull(),
    aiProposalId: uuid("ai_proposal_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("audit_log_org_created_idx").on(table.orgId, table.createdAt)],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("sessions_token_unique").on(table.token)],
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const twoFactors = pgTable("two_factors", {
  id: text("id").primaryKey(),
  secret: text("secret_enc").notNull(),
  backupCodes: text("backup_codes_enc").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const mobileDevices = pgTable(
  "mobile_devices",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    platform: text("platform").notNull(),
    biometricEnabled: boolean("biometric_enabled").default(false).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    wipeRequestedAt: timestamp("wipe_requested_at", { withTimezone: true }),
    wipedAt: timestamp("wiped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("mobile_devices_org_user_idx").on(table.orgId, table.userId)],
);

export const processedMobileActions = pgTable(
  "processed_mobile_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id").notNull().references(() => mobileDevices.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: text("kind").notNull(),
    resourceId: uuid("resource_id"),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("processed_mobile_action_unique").on(table.orgId, table.idempotencyKey)],
);
