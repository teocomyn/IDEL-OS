GRANT UPDATE, DELETE ON audit_log TO idel_app;
DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
DROP FUNCTION IF EXISTS prevent_audit_log_mutation();
