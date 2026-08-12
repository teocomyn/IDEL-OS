DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'idel_app') THEN
    CREATE ROLE idel_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'idel_auth') THEN
    CREATE ROLE idel_auth NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO idel_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO idel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO idel_app;
GRANT USAGE ON SCHEMA public TO idel_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, accounts, sessions, verifications, two_factors TO idel_auth;
GRANT SELECT, INSERT, UPDATE ON organizations, memberships TO idel_auth;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO idel_auth;
--> statement-breakpoint
DO $$
DECLARE
  scoped_table text;
BEGIN
  FOREACH scoped_table IN ARRAY ARRAY[
    'users', 'memberships', 'audit_log', 'patients', 'patient_contacts',
    'prescribers', 'pharmacies', 'consents', 'privacy_requests', 'prescriptions',
    'prescription_items', 'care_plans', 'care_plan_items', 'visits', 'visit_acts',
    'ai_proposals', 'codings', 'coding_lines', 'coding_alerts', 'tours',
    'optimization_runs', 'transmissions', 'vital_signs', 'admin_tasks', 'documents',
    'invoices_mirror', 'mileage_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', scoped_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', scoped_table);
    EXECUTE format(
      'CREATE POLICY organization_isolation ON %I USING (org_id = nullif(current_setting(''app.current_org_id'', true), '''')::uuid) WITH CHECK (org_id = nullif(current_setting(''app.current_org_id'', true), '''')::uuid)',
      scoped_table
    );
  END LOOP;
END
$$;
