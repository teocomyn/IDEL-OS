import type { AuthenticatedProfessional } from "../auth/auth-provider.js";
import type { PatientService } from "../services/patient-service.js";
import type { PrivacyService } from "../services/privacy-service.js";

export type AppContext = {
  professional: AuthenticatedProfessional | null;
  patientService: PatientService;
  privacyService: PrivacyService;
};
