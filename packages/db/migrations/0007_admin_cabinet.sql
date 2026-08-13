CREATE TYPE "message_draft_status" AS ENUM ('draft', 'validated', 'sent', 'cancelled');
CREATE TYPE "replacement_contract_status" AS ENUM ('draft', 'pending_signature', 'active', 'expired', 'terminated');
CREATE TYPE "assignment_change_status" AS ENUM ('proposed', 'applied', 'rejected');
CREATE TYPE "retrocession_status" AS ENUM ('draft', 'validated', 'paid');

ALTER TABLE "admin_tasks" ADD COLUMN "snoozed_until" date;
ALTER TABLE "admin_tasks" ADD COLUMN "completed_by_user_id" uuid REFERENCES "users"("id");
ALTER TABLE "admin_tasks" ADD COLUMN "completed_at" timestamp with time zone;
ALTER TABLE "admin_tasks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
ALTER TABLE "admin_tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

CREATE TABLE "patient_access_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "can_read" boolean DEFAULT false NOT NULL,
  "can_care" boolean DEFAULT false NOT NULL,
  "can_transmit" boolean DEFAULT false NOT NULL,
  "can_schedule" boolean DEFAULT false NOT NULL,
  "can_bill" boolean DEFAULT false NOT NULL,
  "granted_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "patient_access_grants_valid_period" CHECK ("starts_at" < "ends_at")
);
CREATE INDEX "patient_access_grants_org_user_period_idx" ON "patient_access_grants" ("org_id", "user_id", "starts_at", "ends_at");
CREATE INDEX "patient_access_grants_org_patient_idx" ON "patient_access_grants" ("org_id", "patient_id");

CREATE TABLE "replacement_contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "incumbent_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "replacement_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "starts_on" date NOT NULL,
  "ends_on" date NOT NULL,
  "retrocession_rate" numeric(5,2) NOT NULL,
  "status" "replacement_contract_status" DEFAULT 'draft' NOT NULL,
  "document_url" text,
  "validated_by_user_id" uuid REFERENCES "users"("id"),
  "validated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "replacement_contracts_valid_period" CHECK ("starts_on" <= "ends_on"),
  CONSTRAINT "replacement_contracts_valid_rate" CHECK ("retrocession_rate" >= 0 AND "retrocession_rate" <= 100),
  CONSTRAINT "replacement_contracts_distinct_users" CHECK ("incumbent_user_id" <> "replacement_user_id")
);
CREATE INDEX "replacement_contracts_org_period_idx" ON "replacement_contracts" ("org_id", "starts_on", "ends_on");

CREATE TABLE "professional_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "file_url" text NOT NULL,
  "expires_at" date,
  "verified_at" timestamp with time zone,
  "uploaded_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "professional_documents_org_expiry_idx" ON "professional_documents" ("org_id", "expires_at");

CREATE TABLE "message_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "patient_id" uuid REFERENCES "patients"("id") ON DELETE SET NULL,
  "channel" text NOT NULL,
  "recipient_enc" text NOT NULL,
  "subject_enc" text NOT NULL,
  "body_enc" text NOT NULL,
  "status" "message_draft_status" DEFAULT 'draft' NOT NULL,
  "generated_from_rule_key" text,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "validated_by_user_id" uuid REFERENCES "users"("id"),
  "validated_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "message_drafts_valid_channel" CHECK ("channel" IN ('email', 'sms', 'letter', 'mssante'))
);
CREATE INDEX "message_drafts_org_status_idx" ON "message_drafts" ("org_id", "status", "created_at");

CREATE TABLE "visit_assignment_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "visit_id" uuid NOT NULL REFERENCES "visits"("id") ON DELETE CASCADE,
  "from_user_id" uuid REFERENCES "users"("id"),
  "to_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "reason" text NOT NULL,
  "status" "assignment_change_status" DEFAULT 'proposed' NOT NULL,
  "proposed_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "applied_by_user_id" uuid REFERENCES "users"("id"),
  "applied_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "visit_assignment_changes_org_visit_idx" ON "visit_assignment_changes" ("org_id", "visit_id", "created_at");

CREATE TABLE "retrocession_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "incumbent_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "replacement_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "gross_amount_cents" integer NOT NULL,
  "rate" numeric(5,2) NOT NULL,
  "amount_cents" integer NOT NULL,
  "status" "retrocession_status" DEFAULT 'draft' NOT NULL,
  "prepared_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "validated_by_user_id" uuid REFERENCES "users"("id"),
  "validated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "retrocession_periods_valid_period" CHECK ("period_start" <= "period_end"),
  CONSTRAINT "retrocession_periods_non_negative" CHECK ("gross_amount_cents" >= 0 AND "amount_cents" >= 0)
);
CREATE UNIQUE INDEX "retrocession_periods_unique" ON "retrocession_periods" ("org_id", "replacement_user_id", "period_start", "period_end");

CREATE TABLE "cabinet_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "severity" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "resource_type" text,
  "resource_id" uuid,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cabinet_notifications_important_only" CHECK ("severity" IN ('important', 'urgent'))
);
CREATE INDEX "cabinet_notifications_org_user_idx" ON "cabinet_notifications" ("org_id", "user_id", "read_at");

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'patient_access_grants', 'replacement_contracts', 'professional_documents',
    'message_drafts', 'visit_assignment_changes', 'retrocession_periods', 'cabinet_notifications'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY organization_isolation ON %I USING (org_id = nullif(current_setting(''app.current_org_id'', true), '''')::uuid) WITH CHECK (org_id = nullif(current_setting(''app.current_org_id'', true), '''')::uuid)',
      table_name
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO idel_app', table_name);
  END LOOP;
END $$;
