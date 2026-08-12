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
    EXECUTE format('DROP POLICY IF EXISTS organization_isolation ON %I', scoped_table);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', scoped_table);
  END LOOP;
END
$$;
