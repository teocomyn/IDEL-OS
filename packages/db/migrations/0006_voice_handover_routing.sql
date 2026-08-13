ALTER TABLE "transmissions" ADD COLUMN "transcription_mode" text DEFAULT 'manual' NOT NULL;
ALTER TABLE "transmissions" ADD COLUMN "validated_by_user_id" uuid REFERENCES "users"("id");
ALTER TABLE "transmissions" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "visits" ADD COLUMN "hard_time_window" boolean DEFAULT false NOT NULL;
ALTER TABLE "visits" ADD COLUMN "preferred_user_id" uuid REFERENCES "users"("id");
ALTER TABLE "visits" ADD COLUMN "routing_constraints_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "tours" ADD COLUMN "constraints_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "optimization_runs" ADD COLUMN "proposal_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "optimization_runs" ADD COLUMN "accepted_by_user_id" uuid REFERENCES "users"("id");
ALTER TABLE "optimization_runs" ADD COLUMN "accepted_at" timestamp with time zone;
CREATE TABLE "transmission_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "transmission_id" uuid NOT NULL REFERENCES "transmissions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "read_at" timestamp with time zone,
  "acknowledged_at" timestamp with time zone
);
CREATE UNIQUE INDEX "transmission_receipts_unique" ON "transmission_receipts" ("transmission_id", "user_id");
CREATE INDEX "transmission_receipts_org_user_idx" ON "transmission_receipts" ("org_id", "user_id");
ALTER TABLE "transmission_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transmission_receipts" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "transmission_receipts"
  USING (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON transmission_receipts TO idel_app;
