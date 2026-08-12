DROP TABLE IF EXISTS vital_signs, transmissions, optimization_runs, tours,
  mileage_logs, invoices_mirror, documents, admin_tasks, coding_alerts,
  coding_lines, codings, ai_proposals, ngap_rules, act_catalog, visit_acts,
  visits, care_plan_items, care_plans, prescription_items, prescriptions,
  privacy_requests, consents, pharmacies, prescribers, patient_contacts,
  patients, two_factors, verifications, sessions, accounts, audit_log,
  memberships, users, organizations CASCADE;

DROP TYPE IF EXISTS visit_status, user_role, transmission_status, tour_status,
  prescription_status, prescription_source, organization_type, mobility,
  invoice_status, human_decision, invoice_source, coding_status,
  coding_proposer, coding_line_type, care_plan_status, alert_severity,
  ai_proposal_kind, admin_task_status CASCADE;
