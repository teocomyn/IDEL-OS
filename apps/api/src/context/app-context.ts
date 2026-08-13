import type { AuthenticatedProfessional } from "../auth/auth-provider.js";
import type { PatientService } from "../services/patient-service.js";
import type { PrivacyService } from "../services/privacy-service.js";
import type { TransmissionService } from "../services/transmission-service.js";
import type { CarePlanService } from "../services/care-plan-service.js";
import type { VisitService } from "../services/visit-service.js";
import type { PrescriptionService } from "../services/prescription-service.js";
import type { FieldService } from "../services/field-service.js";
import type { DeviceService } from "../services/device-service.js";
import type { OptimizationService } from "../services/optimization-service.js";
import type { CockpitService } from "../services/cockpit-service.js";
import type { CabinetService } from "../services/cabinet-service.js";

export type AppContext = {
  professional: AuthenticatedProfessional | null;
  patientService: PatientService;
  privacyService: PrivacyService;
  transmissionService: TransmissionService;
  carePlanService: CarePlanService;
  visitService: VisitService;
  prescriptionService: PrescriptionService;
  fieldService: FieldService;
  deviceService: DeviceService;
  optimizationService: OptimizationService;
  cockpitService: CockpitService;
  cabinetService: CabinetService;
};
