export * from "./admin.js";
export * from "./care.js";
export * from "./core.js";
export * from "./enums.js";
export * from "./ngap.js";
export * from "./patients.js";
export * from "./tours.js";
export * from "./transmissions.js";

export const organizationScopedTables = [
  "users",
  "memberships",
  "audit_log",
  "patients",
  "patient_contacts",
  "prescribers",
  "pharmacies",
  "consents",
  "privacy_requests",
  "prescriptions",
  "prescription_items",
  "care_plans",
  "care_plan_items",
  "visits",
  "visit_acts",
  "ai_proposals",
  "codings",
  "coding_lines",
  "coding_alerts",
  "tours",
  "optimization_runs",
  "transmissions",
  "vital_signs",
  "admin_tasks",
  "documents",
  "invoices_mirror",
  "mileage_logs",
  "visit_exceptions",
  "mobile_devices",
  "processed_mobile_actions",
] as const;

export const encryptedColumns = [
  "secret_enc",
  "backup_codes_enc",
  "first_name_enc",
  "last_name_enc",
  "birth_date_enc",
  "nir_enc",
  "phone_enc",
  "email_enc",
  "notes_enc",
  "address_line_enc",
  "access_notes_enc",
  "ald_details_enc",
  "name_enc",
  "reason_enc",
  "raw_ocr_text_enc",
  "raw_transcript_enc",
  "final_text_enc",
  "note_enc",
] as const;
