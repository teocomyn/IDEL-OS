CREATE TYPE "public"."visit_exception_type" AS ENUM('absence', 'refusal', 'hospitalization', 'emergency', 'reschedule');
--> statement-breakpoint
CREATE TABLE "mobile_devices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "platform" text NOT NULL,
  "biometric_enabled" boolean DEFAULT false NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "wipe_requested_at" timestamp with time zone,
  "wiped_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mobile_devices_org_user_idx" ON "mobile_devices" USING btree ("org_id","user_id");
--> statement-breakpoint
CREATE TABLE "processed_mobile_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "device_id" uuid NOT NULL REFERENCES "mobile_devices"("id") ON DELETE CASCADE,
  "idempotency_key" text NOT NULL,
  "kind" text NOT NULL,
  "resource_id" uuid,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "processed_mobile_action_unique" ON "processed_mobile_actions" USING btree ("org_id","idempotency_key");
--> statement-breakpoint
CREATE TABLE "visit_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "visit_id" uuid NOT NULL REFERENCES "visits"("id") ON DELETE CASCADE,
  "recorded_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "idempotency_key" text NOT NULL,
  "type" "visit_exception_type" NOT NULL,
  "note_enc" text,
  "previous_scheduled_at" timestamp with time zone,
  "rescheduled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "visit_exceptions_org_idempotency_unique" ON "visit_exceptions" USING btree ("org_id","idempotency_key");
--> statement-breakpoint
DO $$
DECLARE scoped_table text;
BEGIN
  FOREACH scoped_table IN ARRAY ARRAY['mobile_devices', 'processed_mobile_actions', 'visit_exceptions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', scoped_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', scoped_table);
    EXECUTE format(
      'CREATE POLICY organization_isolation ON %I USING (org_id = nullif(current_setting(''app.current_org_id'', true), '''')::uuid) WITH CHECK (org_id = nullif(current_setting(''app.current_org_id'', true), '''')::uuid)',
      scoped_table
    );
  END LOOP;
END
$$;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON mobile_devices, processed_mobile_actions, visit_exceptions TO idel_app;
